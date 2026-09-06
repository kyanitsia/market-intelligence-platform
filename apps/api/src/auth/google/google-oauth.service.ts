import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import type { RefreshResult } from '../auth.types';
import { DATABASE, type Database } from '../../database/database.types';
import { oauthIdentities, users, type User } from '../../database/schema';
import { PortfoliosService } from '../../portfolios/portfolios.service';
import {
  GOOGLE_LINK_TOKEN_TTL,
  GOOGLE_OAUTH_PROVIDER,
  GOOGLE_OAUTH_STATE_TTL,
} from '../auth.constants';
import { AuthService } from '../auth.service';
import {
  getDummySecretHash,
  verifySecret,
} from '../crypto/secret-hash';
import { AccountLinkingRequiredException } from '../exceptions/account-linking-required.exception';
import { GoogleOAuthClient } from './google-oauth.client';
import type {
  GoogleLinkTokenPayload,
  GoogleProfile,
  OAuthStatePayload,
} from './google-oauth.types';

@Injectable()
export class GoogleOAuthService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
    private readonly authService: AuthService,
    private readonly googleOAuthClient: GoogleOAuthClient,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => PortfoliosService))
    private readonly portfoliosService: PortfoliosService,
  ) {}

  createAuthorizationUrl(): string {
    const state = this.jwtService.sign(
      {
        type: 'oauth-state',
        nonce: randomUUID(),
      } satisfies OAuthStatePayload,
      {
        secret: this.stateSecret(),
        expiresIn: GOOGLE_OAUTH_STATE_TTL as NonNullable<
          JwtSignOptions['expiresIn']
        >,
      },
    );

    return this.googleOAuthClient.generateAuthorizationUrl(state);
  }

  async completeAuthorization(
    code: string,
    state: string,
  ): Promise<RefreshResult> {
    this.verifyState(state);

    let profile: GoogleProfile;

    try {
      profile = await this.googleOAuthClient.exchangeAuthorizationCode(code);
    } catch {
      throw new UnauthorizedException('Google authorization failed');
    }

    if (!profile.emailVerified) {
      throw new UnauthorizedException('Google email is not verified');
    }

    const email = profile.email.trim().toLowerCase();
    const existingIdentity = await this.findIdentity(profile.sub);

    if (existingIdentity) {
      const [user] = await this.database
        .select()
        .from(users)
        .where(eq(users.id, existingIdentity.userId))
        .limit(1);

      if (!user) {
        throw new UnauthorizedException();
      }

      return this.authService.startSession(user);
    }

    const [existingUser] = await this.database
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      throw new AccountLinkingRequiredException(
        this.createLinkToken(profile, email),
      );
    }

    return this.database.transaction(async (transaction) => {
      const [createdUser] = await transaction
        .insert(users)
        .values({
          email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          defaultCurrency: 'USD',
        })
        .returning();

      await transaction.insert(oauthIdentities).values({
        userId: createdUser.id,
        provider: GOOGLE_OAUTH_PROVIDER,
        providerUserId: profile.sub,
      });

      await this.portfoliosService.createDefaultForUser(
        createdUser.id,
        transaction,
      );

      return this.authService.startSession(createdUser, transaction);
    });
  }

  async confirmLink(
    linkToken: string,
    password: string,
  ): Promise<RefreshResult> {
    const payload = this.verifyLinkToken(linkToken);
    const existingIdentity = await this.findIdentity(payload.googleSub);

    if (existingIdentity) {
      const [user] = await this.database
        .select()
        .from(users)
        .where(eq(users.id, existingIdentity.userId))
        .limit(1);

      if (!user) {
        throw new UnauthorizedException();
      }

      await this.verifyAccountPassword(user, password);

      return this.authService.startSession(user);
    }

    const [user] = await this.database
      .select()
      .from(users)
      .where(eq(users.email, payload.email))
      .limit(1);

    if (!user) {
      throw new BadRequestException('Account no longer exists');
    }

    await this.verifyAccountPassword(user, password);

    await this.database.insert(oauthIdentities).values({
      userId: user.id,
      provider: GOOGLE_OAUTH_PROVIDER,
      providerUserId: payload.googleSub,
    });

    const profileUpdates: Partial<User> = { updatedAt: new Date() };

    if (!user.displayName && payload.displayName) {
      profileUpdates.displayName = payload.displayName;
    }

    if (!user.avatarUrl && payload.avatarUrl) {
      profileUpdates.avatarUrl = payload.avatarUrl;
    }

    if (profileUpdates.displayName || profileUpdates.avatarUrl) {
      await this.database
        .update(users)
        .set(profileUpdates)
        .where(eq(users.id, user.id));
    }

    const [updatedUser] = await this.database
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    return this.authService.startSession(updatedUser ?? user);
  }

  private async verifyAccountPassword(
    user: User,
    password: string,
  ): Promise<void> {
    const hashToVerify = user.passwordHash ?? (await getDummySecretHash());

    let validPassword = false;

    try {
      validPassword = await verifySecret(hashToVerify, password);
    } catch {
      validPassword = false;
    }

    if (!user.passwordHash || !validPassword) {
      throw new UnauthorizedException('Invalid password');
    }
  }

  private async findIdentity(googleSub: string) {
    const [identity] = await this.database
      .select()
      .from(oauthIdentities)
      .where(
        and(
          eq(oauthIdentities.provider, GOOGLE_OAUTH_PROVIDER),
          eq(oauthIdentities.providerUserId, googleSub),
        ),
      )
      .limit(1);

    return identity;
  }

  private createLinkToken(profile: GoogleProfile, email: string): string {
    const payload: GoogleLinkTokenPayload = {
      type: 'google-link',
      email,
      googleSub: profile.sub,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    };

    return this.jwtService.sign(payload, {
      secret: this.stateSecret(),
      expiresIn: GOOGLE_LINK_TOKEN_TTL as NonNullable<
        JwtSignOptions['expiresIn']
      >,
    });
  }

  private verifyLinkToken(linkToken: string): GoogleLinkTokenPayload {
    try {
      const payload = this.jwtService.verify<GoogleLinkTokenPayload>(
        linkToken,
        { secret: this.stateSecret() },
      );

      if (
        payload.type !== 'google-link' ||
        !payload.email ||
        !payload.googleSub
      ) {
        throw new Error('invalid');
      }

      return payload;
    } catch {
      throw new BadRequestException('Invalid or expired link confirmation');
    }
  }

  private verifyState(state: string): void {
    try {
      const payload = this.jwtService.verify<OAuthStatePayload>(state, {
        secret: this.stateSecret(),
      });

      if (payload.type !== 'oauth-state' || !payload.nonce) {
        throw new Error('invalid');
      }
    } catch {
      throw new UnauthorizedException('Invalid OAuth state');
    }
  }

  private stateSecret(): string {
    return this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
  }
}
