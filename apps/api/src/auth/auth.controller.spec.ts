import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthController } from './auth.controller';
import {
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
} from './auth.constants';
import type { AuthService } from './auth.service';
import type { AuthenticationResult } from './auth.types';
import { AccountLinkingRequiredException } from './exceptions/account-linking-required.exception';
import type { GoogleOAuthService } from './google/google-oauth.service';

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
  let googleOAuthService: {
    createAuthorizationUrl: jest.Mock;
    completeAuthorization: jest.Mock;
    confirmLink: jest.Mock;
  };
  let configService: { get: jest.Mock };
  let controller: AuthController;
  let response: Pick<Response, 'cookie' | 'clearCookie' | 'redirect'>;

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    };
    googleOAuthService = {
      createAuthorizationUrl: jest.fn(),
      completeAuthorization: jest.fn(),
      confirmLink: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') {
          return 'test';
        }

        return undefined;
      }),
    };
    controller = new AuthController(
      authService as unknown as AuthService,
      googleOAuthService as unknown as GoogleOAuthService,
      configService as never,
    );
    response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn(),
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
        sameSite: 'lax',
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

  it('returns 401 when the refresh cookie is missing', async () => {
    await expect(
      controller.refresh(
        { cookies: {} } as unknown as Request,
        response as Response,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
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
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
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

  it('starts Google OAuth with a redirect URL', () => {
    googleOAuthService.createAuthorizationUrl.mockReturnValue(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );

    expect(controller.startGoogleAuth()).toEqual({
      url: 'https://accounts.google.com/o/oauth2/v2/auth',
      statusCode: 302,
    });
  });

  it('completes Google OAuth and sets the refresh cookie', async () => {
    googleOAuthService.completeAuthorization.mockResolvedValue({
      authentication,
      refreshToken: 'refresh-token',
    });

    const result = await controller.googleCallback(
      'code',
      'state',
      undefined,
      response as Response,
    );

    expect(result).toEqual(authentication);
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'refresh-token',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(response.redirect).not.toHaveBeenCalled();
  });

  it('redirects to the link URL when Google email already exists', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'GOOGLE_OAUTH_LINK_URL') {
        return 'http://localhost:5173/auth/link';
      }

      return undefined;
    });
    googleOAuthService.completeAuthorization.mockRejectedValue(
      new AccountLinkingRequiredException('link-token'),
    );

    await controller.googleCallback(
      'code',
      'state',
      undefined,
      response as Response,
    );

    expect(response.redirect).toHaveBeenCalledWith(
      'http://localhost:5173/auth/link?linkToken=link-token',
    );
  });

  it('confirms Google account linking and sets the refresh cookie', async () => {
    googleOAuthService.confirmLink.mockResolvedValue({
      authentication,
      refreshToken: 'refresh-token',
    });

    const result = await controller.confirmGoogleLink(
      { linkToken: 'link-token', password: 'password123' },
      response as Response,
    );

    expect(result).toEqual(authentication);
    expect(googleOAuthService.confirmLink).toHaveBeenCalledWith(
      'link-token',
      'password123',
    );
    expect(response.cookie).toHaveBeenCalled();
  });

  it('sets Secure cookies by default in production', async () => {
    configService.get.mockImplementation((key: string) =>
      key === 'NODE_ENV' ? 'production' : undefined,
    );
    authService.register.mockResolvedValue({
      authentication,
      refreshToken: 'refresh-token',
    });

    await controller.register(
      { email: 'test@example.com', password: 'password123' },
      response as Response,
    );

    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'refresh-token',
      expect.objectContaining({ secure: true }),
    );
  });
});
