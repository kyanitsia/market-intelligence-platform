import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import {
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
} from './auth.constants';
import { AuthService } from './auth.service';
import type { AuthenticationResult } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

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
    });
  }

  private setRefreshTokenCookie(
    response: Response,
    refreshToken: string,
  ): void {
    const secure =
      this.configService.get<string>('AUTH_COOKIE_SECURE', 'false') === 'true';

    response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: REFRESH_TOKEN_COOKIE_PATH,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}
