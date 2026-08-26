import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { DATABASE, type Database } from '../database/database.types';
import { authSessions, users, type User } from '../database/schema';
import {
  ACCESS_TOKEN_DEFAULT_TTL,
  REFRESH_TOKEN_DEFAULT_TTL,
} from './auth.constants';
import {
  getDummySecretHash,
  hashSecret,
  verifySecret,
} from './crypto/secret-hash';
import type {
  AccessTokenPayload,
  PublicUser,
  RefreshResult,
  RefreshTokenPayload,
} from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,

    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<RefreshResult> {
    const email = this.normalizeEmail(dto.email);

    const existingUser = await this.findUserByEmail(email);

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await hashSecret(dto.password);

    try {
      return await this.database.transaction(async (transaction) => {
        const [createdUser] = await transaction
          .insert(users)
          .values({
            email,
            passwordHash,
            defaultCurrency: 'USD',
          })
          .returning();

        return this.startSession(createdUser, transaction);
      });
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<RefreshResult> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.findUserByEmail(email);

    // Perform a hash verification even when the account does not
    // exist to reduce observable timing differences.
    const hashToVerify = user?.passwordHash ?? (await getDummySecretHash());

    let validPassword = false;

    try {
      validPassword = await verifySecret(hashToVerify, dto.password);
    } catch {
      validPassword = false;
    }

    if (!user || !user.passwordHash || !validPassword) {
      // Do not reveal whether the email exists.
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.startSession(user);
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    const payload = await this.verifyRefreshToken(refreshToken);

    return this.database.transaction(async (transaction) => {
      // Serialize rotation attempts for this session.
      await transaction.execute(sql`
            SELECT id
            FROM auth_sessions
            WHERE id = ${payload.sid}::uuid
            FOR UPDATE
          `);

      const [session] = await transaction
        .select()
        .from(authSessions)
        .where(
          and(
            eq(authSessions.id, payload.sid),
            eq(authSessions.userId, payload.sub),
            eq(authSessions.familyId, payload.familyId),
            isNull(authSessions.revokedAt),
            gt(authSessions.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (!session) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokenMatches = await verifySecret(
        session.refreshTokenHash,
        refreshToken,
      );

      if (!tokenMatches) {
        // A validly signed but already rotated token was reused.
        await transaction
          .update(authSessions)
          .set({
            revokedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(authSessions.familyId, payload.familyId));

        throw new UnauthorizedException('Refresh token reuse detected');
      }

      const [user] = await transaction
        .select()
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);

      if (!user) {
        throw new UnauthorizedException();
      }

      const tokens = await this.signTokens({
        user,
        sessionId: session.id,
        familyId: session.familyId,
      });

      await transaction
        .update(authSessions)
        .set({
          refreshTokenHash: await hashSecret(tokens.refreshToken),
          expiresAt: this.getRefreshTokenExpirationDate(),
          updatedAt: new Date(),
        })
        .where(eq(authSessions.id, session.id));

      return {
        authentication: {
          accessToken: tokens.accessToken,
          user: this.toPublicUser(user),
        },
        refreshToken: tokens.refreshToken,
      };
    });
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const payload = await this.verifyRefreshToken(refreshToken);

      await this.database
        .update(authSessions)
        .set({
          revokedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(authSessions.id, payload.sid));
    } catch {
      // Logout stays idempotent. The cookie will still be removed.
    }
  }

  async startSession(
    user: User,
    executor: Pick<Database, 'insert'> = this.database,
  ): Promise<RefreshResult> {
    const sessionId = randomUUID();
    const familyId = randomUUID();

    const tokens = await this.signTokens({
      user,
      sessionId,
      familyId,
    });

    await executor.insert(authSessions).values({
      id: sessionId,
      userId: user.id,
      familyId,
      refreshTokenHash: await hashSecret(tokens.refreshToken),
      expiresAt: this.getRefreshTokenExpirationDate(),
    });

    return {
      authentication: {
        accessToken: tokens.accessToken,
        user: this.toPublicUser(user),
      },
      refreshToken: tokens.refreshToken,
    };
  }

  private async signTokens(input: {
    user: User;
    sessionId: string;
    familyId: string;
  }): Promise<TokenPair> {
    const accessPayload: AccessTokenPayload = {
      sub: input.user.id,
      email: input.user.email,
      type: 'access',
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: input.user.id,
      sid: input.sessionId,
      familyId: input.familyId,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.getJwtExpiresIn(
          'JWT_ACCESS_EXPIRES_IN',
          ACCESS_TOKEN_DEFAULT_TTL,
        ),
      }),

      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.getJwtExpiresIn(
          'JWT_REFRESH_EXPIRES_IN',
          REFRESH_TOKEN_DEFAULT_TTL,
        ),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );

      if (
        payload.type !== 'refresh' ||
        !payload.sub ||
        !payload.sid ||
        !payload.familyId
      ) {
        throw new UnauthorizedException();
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async findUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.database
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      defaultCurrency: user.defaultCurrency,
      createdAt: user.createdAt,
    };
  }

  private getJwtExpiresIn(
    envKey: string,
    fallback: string,
  ): NonNullable<JwtSignOptions['expiresIn']> {
    return (this.configService.get<string>(envKey) ?? fallback) as NonNullable<
      JwtSignOptions['expiresIn']
    >;
  }

  private getRefreshTokenExpirationDate(): Date {
    // Keep this synchronized with JWT_REFRESH_EXPIRES_IN.
    // The MVP default is 30 days.
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    return expiresAt;
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return error.code === '23505';
  }
}
