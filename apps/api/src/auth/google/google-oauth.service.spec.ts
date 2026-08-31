import { BadRequestException, UnauthorizedException } from '@nestjs/common';

import type { User } from '../../database/schema';
import { AccountLinkingRequiredException } from '../exceptions/account-linking-required.exception';
import { GoogleOAuthService } from './google-oauth.service';
import type { GoogleProfile } from './google-oauth.types';

const now = new Date('2026-01-15T12:00:00.000Z');

const profile: GoogleProfile = {
  sub: 'google-sub',
  email: 'Test@Example.com',
  emailVerified: true,
  displayName: 'Ada Lovelace',
  avatarUrl: 'https://example.com/ada.png',
};

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-id',
    email: 'test@example.com',
    passwordHash: 'stored-hash',
    displayName: 'Existing User',
    avatarUrl: null,
    defaultCurrency: 'USD',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createSelectLimit(rows: unknown[]) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

describe('GoogleOAuthService', () => {
  const sessionResult = {
    authentication: {
      accessToken: 'access-token',
      user: {
        id: 'user-id',
        email: 'test@example.com',
        displayName: 'Existing User',
        avatarUrl: null,
        defaultCurrency: 'USD',
        createdAt: now,
      },
    },
    refreshToken: 'refresh-token',
  };

  let database: {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
    transaction: jest.Mock;
  };
  let authService: { startSession: jest.Mock };
  let googleOAuthClient: {
    generateAuthorizationUrl: jest.Mock;
    exchangeAuthorizationCode: jest.Mock;
  };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let portfoliosService: { createDefaultForUser: jest.Mock };
  let service: GoogleOAuthService;

  beforeEach(() => {
    database = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      transaction: jest.fn(),
    };
    authService = {
      startSession: jest.fn().mockResolvedValue(sessionResult),
    };
    googleOAuthClient = {
      generateAuthorizationUrl: jest
        .fn()
        .mockReturnValue('https://google/auth'),
      exchangeAuthorizationCode: jest.fn().mockResolvedValue(profile),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
      verify: jest
        .fn()
        .mockReturnValue({ type: 'oauth-state', nonce: 'nonce' }),
    };
    configService = {
      getOrThrow: jest.fn().mockReturnValue('jwt-secret'),
    };
    portfoliosService = {
      createDefaultForUser: jest.fn().mockResolvedValue(undefined),
    };
    service = new GoogleOAuthService(
      database as never,
      authService as never,
      googleOAuthClient as never,
      jwtService as never,
      configService as never,
      portfoliosService as never,
    );
  });

  it('creates an authorization URL with signed state', () => {
    expect(service.createAuthorizationUrl()).toBe('https://google/auth');
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'oauth-state' }),
      expect.objectContaining({ secret: 'jwt-secret', expiresIn: '10m' }),
    );
    expect(googleOAuthClient.generateAuthorizationUrl).toHaveBeenCalledWith(
      'signed-token',
    );
  });

  it('logs in when a Google identity already exists', async () => {
    const user = makeUser();

    database.select
      .mockReturnValueOnce(createSelectLimit([{ userId: user.id }]))
      .mockReturnValueOnce(createSelectLimit([user]));

    await expect(
      service.completeAuthorization('code', 'state'),
    ).resolves.toEqual(sessionResult);
    expect(authService.startSession).toHaveBeenCalledWith(user);
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation when the email already exists', async () => {
    jwtService.sign.mockReturnValue('link-token');
    database.select
      .mockReturnValueOnce(createSelectLimit([]))
      .mockReturnValueOnce(createSelectLimit([makeUser()]));

    await expect(
      service.completeAuthorization('code', 'state'),
    ).rejects.toBeInstanceOf(AccountLinkingRequiredException);
    expect(authService.startSession).not.toHaveBeenCalled();
  });

  it('creates a user and Google identity for a new email', async () => {
    const createdUser = makeUser({
      email: 'test@example.com',
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      passwordHash: null,
    });
    const transaction = {
      insert: jest
        .fn()
        .mockReturnValueOnce({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([createdUser]),
          }),
        })
        .mockReturnValueOnce({
          values: jest.fn().mockResolvedValue(undefined),
        }),
    };

    database.select
      .mockReturnValueOnce(createSelectLimit([]))
      .mockReturnValueOnce(createSelectLimit([]));
    database.transaction.mockImplementation(async (callback) =>
      callback(transaction),
    );

    await expect(
      service.completeAuthorization('code', 'state'),
    ).resolves.toEqual(sessionResult);
    expect(portfoliosService.createDefaultForUser).toHaveBeenCalledWith(
      createdUser.id,
      transaction,
    );
    expect(authService.startSession).toHaveBeenCalledWith(
      createdUser,
      transaction,
    );
  });

  it('rejects an unverified Google email', async () => {
    googleOAuthClient.exchangeAuthorizationCode.mockResolvedValue({
      ...profile,
      emailVerified: false,
    });

    await expect(
      service.completeAuthorization('code', 'state'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid OAuth state', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid');
    });

    await expect(
      service.completeAuthorization('code', 'state'),
    ).rejects.toThrow(new UnauthorizedException('Invalid OAuth state'));
  });

  it('links Google to an existing account after confirmation', async () => {
    const user = makeUser({ displayName: null, avatarUrl: null });
    const updatedUser = makeUser({
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    });

    jwtService.verify.mockReturnValue({
      type: 'google-link',
      email: 'test@example.com',
      googleSub: profile.sub,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    });
    database.select
      .mockReturnValueOnce(createSelectLimit([]))
      .mockReturnValueOnce(createSelectLimit([user]))
      .mockReturnValueOnce(createSelectLimit([updatedUser]));
    database.insert.mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    });
    database.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });

    await expect(service.confirmLink('link-token')).resolves.toEqual(
      sessionResult,
    );
    expect(database.insert).toHaveBeenCalled();
    expect(authService.startSession).toHaveBeenCalledWith(updatedUser);
  });

  it('rejects an invalid link token', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid');
    });

    await expect(service.confirmLink('bad-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
