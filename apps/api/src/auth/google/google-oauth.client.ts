import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

import { GOOGLE_OAUTH_SCOPES } from '../auth.constants';
import type { GoogleProfile } from './google-oauth.types';

@Injectable()
export class GoogleOAuthClient {
  private client: OAuth2Client | undefined;
  private clientId: string | undefined;

  constructor(private readonly configService: ConfigService) {}

  generateAuthorizationUrl(state: string): string {
    return this.getClient().generateAuthUrl({
      access_type: 'online',
      scope: [...GOOGLE_OAUTH_SCOPES],
      state,
      include_granted_scopes: false,
      prompt: 'select_account',
    });
  }

  async exchangeAuthorizationCode(code: string): Promise<GoogleProfile> {
    const client = this.getClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.id_token) {
      throw new Error('Google did not return an ID token');
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.clientId,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) {
      throw new Error('Google ID token is missing subject or email');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      displayName: payload.name ?? null,
      avatarUrl: payload.picture ?? null,
    };
  }

  private getClient(): OAuth2Client {
    if (this.client) {
      return this.client;
    }

    this.clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    this.client = new OAuth2Client(
      this.clientId,
      this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
    );

    return this.client;
  }
}
