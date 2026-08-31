import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';

import { AuthService } from './auth.service';
import type { RefreshTokenPayload } from './auth.types';
import * as secretHash from './crypto/secret-hash';
import type { User } from '../database/schema';

jest.mock('./crypto/secret-hash', () => ({
  hashSecret: jest.fn(),
  verifySecret: jest.fn(),
  getDummySecretHash: jest.fn(),
}));

jest.mock('node:crypto', () => {
  const actual = jest.requireActual('node:crypto');

  return {
    ...actual,
    randomUUID: jest.fn(),
  };
});

const hashSecret = secretHash.hashSecret as jest.MockedFunction<
  typeof secretHash.hashSecret
>;
const verifySecret = secretHash.verifySecret as jest.MockedFunction<
  typeof secretHash.verifySecret
>;
const getDummySecretHash = secretHash.getDummySecretHash as jest.MockedFunction<
  typeof secretHash.getDummySecretHash
>;
const randomUUIDMock = randomUUID as jest.MockedFunction<typeof randomUUID>;

const now = new Date('2026-01-15T12:00:00.000Z');

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-id',
    email: 'test@example.com',
    passwordHash: 'stored-hash',
    displayName: 'Test User',
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

describe('AuthService', () => {
  let service: AuthService;
  let database: {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
    transaction: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let configService: { getOrThrow: jest.Mock; get: jest.Mock };
  let portfoliosService: { createDefaultForUser: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    hashSecret.mockResolvedValue('hashed-token');
    verifySecret.mockResolvedValue(true);
    getDummySecretHash.mockResolvedValue('dummy-hash');
    randomUUIDMock
      .mockReturnValueOnce('11111111-1111-1111-1111-111111111111')
      .mockReturnValueOnce('22222222-2222-2222-2222-222222222222');

    database = {
      select: jest.fn().mockReturnValue(createSelectLimit([])),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      }),
      transaction: jest.fn(),
    };

    jwtService = {
      signAsync: jest
        .fn()
        .mockImplementation(async (payload: { type: string }) =>
          payload.type === 'access' ? 'access-token' : 'refresh-token',
        ),
      verifyAsync: jest.fn(),
    };

    configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') {
          return 'access-secret';
        }

        if (key === 'JWT_REFRESH_SECRET') {
          return 'refresh-secret';
        }

        throw new Error(`Missing ${key}`);
      }),
      get: jest.fn().mockReturnValue(undefined),
    };

    portfoliosService = {
      createDefaultForUser: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      database as never,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      portfoliosService as never,
    );
  });

  describe('register', () => {
    it('creates a user, default portfolio, session, and token pair', async () => {
      const createdUser = makeUser();
      const insert = jest.fn().mockImplementation(() => ({
        values: jest.fn((values: { email?: string }) => {
          if (values.email) {
            return {
              returning: jest.fn().mockResolvedValue([createdUser]),
            };
          }

          return Promise.resolve();
        }),
      }));

      database.transaction.mockImplementation(async (callback) =>
        callback({ insert }),
      );

      const result = await service.register({
        email: '  Test@Example.com ',
        password: 'password123',
      });

      expect(hashSecret).toHaveBeenCalledWith('password123');
      expect(portfoliosService.createDefaultForUser).toHaveBeenCalledWith(
        createdUser.id,
        expect.objectContaining({ insert }),
      );
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.authentication).toEqual({
        accessToken: 'access-token',
        user: {
          id: createdUser.id,
          email: createdUser.email,
          displayName: createdUser.displayName,
          avatarUrl: createdUser.avatarUrl,
          defaultCurrency: createdUser.defaultCurrency,
          createdAt: createdUser.createdAt,
        },
      });
      expect(insert).toHaveBeenCalledTimes(2);
    });

    it('throws ConflictException when the email already exists', async () => {
      database.select.mockReturnValue(createSelectLimit([makeUser()]));

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('maps unique violations to ConflictException', async () => {
      database.transaction.mockRejectedValue({ code: '23505' });

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rethrows unexpected errors', async () => {
      database.transaction.mockRejectedValue(new Error('db down'));

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow('db down');
    });
  });

  describe('login', () => {
    it('returns a session for a valid password', async () => {
      const user = makeUser();
      database.select.mockReturnValue(createSelectLimit([user]));

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(verifySecret).toHaveBeenCalledWith(
        user.passwordHash,
        'password123',
      );
      expect(result.authentication.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('rejects an unknown email without revealing that it is missing', async () => {
      verifySecret.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'missing@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('rejects a wrong password', async () => {
      database.select.mockReturnValue(createSelectLimit([makeUser()]));
      verifySecret.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('rejects a user without a password hash', async () => {
      database.select.mockReturnValue(
        createSelectLimit([makeUser({ passwordHash: null })]),
      );

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    const payload: RefreshTokenPayload = {
      sub: 'user-id',
      sid: 'session-id',
      familyId: 'family-id',
      type: 'refresh',
    };

    const session = {
      id: 'session-id',
      userId: 'user-id',
      familyId: 'family-id',
      refreshTokenHash: 'stored-refresh-hash',
      expiresAt: now,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    function mockRefreshTransaction(options: {
      session?: typeof session | undefined;
      user?: User | undefined;
      updateWhere?: jest.Mock;
    }) {
      const updateWhere =
        options.updateWhere ?? jest.fn().mockResolvedValue(undefined);

      database.transaction.mockImplementation(async (callback) =>
        callback({
          execute: jest.fn().mockResolvedValue(undefined),
          select: jest
            .fn()
            .mockReturnValueOnce(
              createSelectLimit(options.session ? [options.session] : []),
            )
            .mockReturnValueOnce(
              createSelectLimit(options.user ? [options.user] : []),
            ),
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: updateWhere,
            }),
          }),
        }),
      );
    }

    it('rotates the refresh token for a valid session', async () => {
      jwtService.verifyAsync.mockResolvedValue(payload);
      mockRefreshTransaction({ session, user: makeUser() });

      const result = await service.refresh('current-refresh-token');

      expect(result.refreshToken).toBe('refresh-token');
      expect(result.authentication.accessToken).toBe('access-token');
      expect(verifySecret).toHaveBeenCalledWith(
        session.refreshTokenHash,
        'current-refresh-token',
      );
    });

    it('rejects a missing session', async () => {
      jwtService.verifyAsync.mockResolvedValue(payload);
      mockRefreshTransaction({});

      await expect(service.refresh('current-refresh-token')).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });

    it('revokes the family when a rotated token is reused', async () => {
      jwtService.verifyAsync.mockResolvedValue(payload);
      verifySecret.mockResolvedValue(false);
      const updateWhere = jest.fn().mockResolvedValue(undefined);
      mockRefreshTransaction({ session, updateWhere });

      await expect(service.refresh('old-refresh-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token reuse detected'),
      );

      expect(updateWhere).toHaveBeenCalled();
    });

    it('rejects when the user no longer exists', async () => {
      jwtService.verifyAsync.mockResolvedValue(payload);
      mockRefreshTransaction({ session });

      await expect(
        service.refresh('current-refresh-token'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an invalid refresh JWT', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('bad token'));

      await expect(service.refresh('bad-token')).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });

    it('rejects a payload that is not a refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        ...payload,
        type: 'access',
      });

      await expect(service.refresh('access-token')).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });
  });

  describe('logout', () => {
    it('is a no-op without a refresh token', async () => {
      await service.logout();

      expect(database.update).not.toHaveBeenCalled();
    });

    it('revokes the session for a valid refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-id',
        sid: 'session-id',
        familyId: 'family-id',
        type: 'refresh',
      });

      await service.logout('refresh-token');

      expect(database.update).toHaveBeenCalled();
    });

    it('stays idempotent when the token is invalid', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('bad token'));

      await expect(service.logout('bad-token')).resolves.toBeUndefined();
    });
  });
});
