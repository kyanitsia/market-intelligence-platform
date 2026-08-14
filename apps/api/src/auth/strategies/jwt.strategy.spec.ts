import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtStrategy } from './jwt.strategy';
import type { AccessTokenPayload } from '../auth.types';

describe('JwtStrategy', () => {
  const strategy = new JwtStrategy({
    getOrThrow: jest.fn().mockReturnValue('access-secret'),
  } as unknown as ConfigService);

  it('returns the authenticated user from an access token', () => {
    const payload: AccessTokenPayload = {
      sub: 'user-id',
      email: 'test@example.com',
      type: 'access',
    };

    expect(strategy.validate(payload)).toEqual({
      id: 'user-id',
      email: 'test@example.com',
    });
  });

  it('rejects a refresh token payload', () => {
    expect(() =>
      strategy.validate({
        sub: 'user-id',
        email: 'test@example.com',
        type: 'refresh',
      } as unknown as AccessTokenPayload),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a payload without a subject', () => {
    expect(() =>
      strategy.validate({
        sub: '',
        email: 'test@example.com',
        type: 'access',
      }),
    ).toThrow(UnauthorizedException);
  });
});
