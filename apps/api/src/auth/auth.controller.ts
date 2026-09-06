import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Redirect,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import {
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
} from './auth.constants';
import { AuthService } from './auth.service';
import type { AuthenticationResult } from './auth.types';
import { ConfirmGoogleLinkDto } from './dto/confirm-google-link.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AccountLinkingRequiredException } from './exceptions/account-linking-required.exception';
import { GoogleOAuthService } from './google/google-oauth.service';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @Redirect()
  startGoogleAuth() {
    return {
      url: this.googleOAuthService.createAuthorizationUrl(),
      statusCode: HttpStatus.FOUND,
    };
  }

  @Get('google/callback')
  @SkipThrottle()
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticationResult | void> {
    if (error || !code || !state) {
      throw new UnauthorizedException('Google authorization failed');
    }

    try {
      const result = await this.googleOAuthService.completeAuthorization(
        code,
        state,
      );

      this.setRefreshTokenCookie(response, result.refreshToken);

      const successUrl = this.configService.get<string>(
        'GOOGLE_OAUTH_SUCCESS_URL',
      );

      if (successUrl) {
        response.redirect(successUrl);
        return;
      }

      return result.authentication;
    } catch (caught: unknown) {
      if (caught instanceof AccountLinkingRequiredException) {
        const payload = caught.getResponse() as { linkToken?: string };
        const linkUrl = this.configService.get<string>('GOOGLE_OAUTH_LINK_URL');

        if (linkUrl && payload.linkToken) {
          const redirectUrl = new URL(linkUrl);
          redirectUrl.searchParams.set('linkToken', payload.linkToken);
          response.redirect(redirectUrl.toString());
          return;
        }
      }

      throw caught;
    }
  }

  @Post('google/link')
  @HttpCode(HttpStatus.OK)
  async confirmGoogleLink(
    @Body() dto: ConfirmGoogleLinkDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticationResult> {
    const result = await this.googleOAuthService.confirmLink(
      dto.linkToken,
      dto.password,
    );

    this.setRefreshTokenCookie(response, result.refreshToken);

    return result.authentication;
  }

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticationResult> {
    const result = await this.authService.register(dto);

    this.setRefreshTokenCookie(response, result.refreshToken);

    return result.authentication;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticationResult> {
    const result = await this.authService.login(dto);

    this.setRefreshTokenCookie(response, result.refreshToken);

    return result.authentication;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticationResult> {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE];

    if (typeof refreshToken !== 'string' || !refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    const result = await this.authService.refresh(refreshToken);

    this.setRefreshTokenCookie(response, result.refreshToken);

    return result.authentication;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SkipThrottle()
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE];

    await this.authService.logout(
      typeof refreshToken === 'string' ? refreshToken : undefined,
    );

    response.clearCookie(REFRESH_TOKEN_COOKIE, {
      path: REFRESH_TOKEN_COOKIE_PATH,
      httpOnly: true,
      secure: this.isSecureCookie(),
      sameSite: this.getSameSite(),
    });
  }

  private setRefreshTokenCookie(
    response: Response,
    refreshToken: string,
  ): void {
    response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: this.isSecureCookie(),
      sameSite: this.getSameSite(),
      path: REFRESH_TOKEN_COOKIE_PATH,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  private getSameSite(): 'lax' | 'strict' | 'none' {
    const configured = this.configService
      .get<string>('AUTH_COOKIE_SAMESITE')
      ?.toLowerCase();

    if (configured === 'none' || configured === 'strict' || configured === 'lax') {
      return configured;
    }

    return 'lax';
  }

  private isSecureCookie(): boolean {
    const configured = this.configService.get<string>('AUTH_COOKIE_SECURE');

    if (configured === 'true') {
      return true;
    }

    if (configured === 'false') {
      return false;
    }

    if (this.getSameSite() === 'none') {
      return true;
    }

    return this.configService.get<string>('NODE_ENV') === 'production';
  }
}
