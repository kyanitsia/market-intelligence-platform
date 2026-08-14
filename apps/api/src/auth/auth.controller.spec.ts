import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthController } from './auth.controller';
import {
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
} from './auth.constants';
import type { AuthService } from './auth.service';
import type { AuthenticationResult } from './auth.types';

describe('AuthController', () => {
  const authentication: AuthenticationResult = {
    accessToken: 'access-token',
    user: {
      id: 'user-id',
      email: 'test@example.com',
      displayName: null,
      avatarUrl: null,
      defaultCurrency: 'USD',
      createdAt: new Date('2026-01-15T12:00:00.000Z'),
    },
  };

  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
  };
  let configService: { get: jest.Mock };
  let controller: AuthController;
  let response: Pick<Response, 'cookie' | 'clearCookie'>;

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue('false'),
    };
    controller = new AuthController(
      authService as unknown as AuthService,
      configService as never,
    );
    response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
  });

  it('registers a user and sets the refresh cookie', async () => {
    authService.register.mockResolvedValue({
      authentication,
      refreshToken: 'refresh-token',
    });

    const result = await controller.register(
      { email: 'test@example.com', password: 'password123' },
      response as Response,
    );

    expect(result).toEqual(authentication);
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'refresh-token',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        path: REFRESH_TOKEN_COOKIE_PATH,
      }),
    );
  });

  it('logs in a user and sets the refresh cookie', async () => {
    authService.login.mockResolvedValue({
      authentication,
      refreshToken: 'refresh-token',
    });

    const result = await controller.login(
      { email: 'test@example.com', password: 'password123' },
      response as Response,
    );

    expect(result).toEqual(authentication);
    expect(response.cookie).toHaveBeenCalled();
  });

  it('refreshes tokens from the cookie', async () => {
    authService.refresh.mockResolvedValue({
      authentication,
      refreshToken: 'next-refresh-token',
    });

    const result = await controller.refresh(
      {
        cookies: { [REFRESH_TOKEN_COOKIE]: 'refresh-token' },
      } as unknown as Request,
      response as Response,
    );

    expect(authService.refresh).toHaveBeenCalledWith('refresh-token');
    expect(result).toEqual(authentication);
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'next-refresh-token',
      expect.any(Object),
    );
  });

  it('rejects refresh without a cookie', async () => {
    await expect(
      controller.refresh(
        { cookies: {} } as unknown as Request,
        response as Response,
      ),
    ).rejects.toThrow(new UnauthorizedException('Refresh token is missing'));
  });

  it('logs out and clears the refresh cookie', async () => {
    authService.logout.mockResolvedValue(undefined);

    await controller.logout(
      {
        cookies: { [REFRESH_TOKEN_COOKIE]: 'refresh-token' },
      } as unknown as Request,
      response as Response,
    );

    expect(authService.logout).toHaveBeenCalledWith('refresh-token');
    expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE, {
      path: REFRESH_TOKEN_COOKIE_PATH,
    });
  });

  it('logs out even when the cookie is missing', async () => {
    await controller.logout(
      { cookies: {} } as unknown as Request,
      response as Response,
    );

    expect(authService.logout).toHaveBeenCalledWith(undefined);
    expect(response.clearCookie).toHaveBeenCalled();
  });
});
