import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

import { GOOGLE_OAUTH_SCOPES } from '../auth.constants';
import { GoogleOAuthClient } from './google-oauth.client';

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(),
}));

describe('GoogleOAuthClient', () => {
  const generateAuthUrl = jest.fn().mockReturnValue('https://google/auth');
  const getToken = jest.fn();
  const verifyIdToken = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (OAuth2Client as unknown as jest.Mock).mockImplementation(() => ({
      generateAuthUrl,
      getToken,
      verifyIdToken,
    }));
  });

  function createClient() {
    const configService = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          GOOGLE_CLIENT_ID: 'client-id',
          GOOGLE_CLIENT_SECRET: 'client-secret',
          GOOGLE_REDIRECT_URI:
            'http://localhost:3000/api/v1/auth/google/callback',
        };

        return values[key];
      }),
    };

    return new GoogleOAuthClient(configService as unknown as ConfigService);
  }

  it('requests only openid, email, and profile scopes', () => {
    const client = createClient();

    expect(client.generateAuthorizationUrl('state-token')).toBe(
      'https://google/auth',
    );
    expect(generateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: [...GOOGLE_OAUTH_SCOPES],
        state: 'state-token',
        access_type: 'online',
      }),
    );
    expect(GOOGLE_OAUTH_SCOPES).toEqual(['openid', 'email', 'profile']);
  });

  it('exchanges an authorization code for a verified profile', async () => {
    getToken.mockResolvedValue({ tokens: { id_token: 'id-token' } });
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub',
        email: 'ada@example.com',
        email_verified: true,
        name: 'Ada',
        picture: 'https://example.com/ada.png',
      }),
    });

    const client = createClient();
    const profile = await client.exchangeAuthorizationCode('code');

    expect(profile).toEqual({
      sub: 'google-sub',
      email: 'ada@example.com',
      emailVerified: true,
      displayName: 'Ada',
      avatarUrl: 'https://example.com/ada.png',
    });
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'id-token',
      audience: 'client-id',
    });
  });
});
