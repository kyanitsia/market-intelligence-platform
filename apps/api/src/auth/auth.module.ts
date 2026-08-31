import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';

import { PortfoliosModule } from '../portfolios/portfolios.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleOAuthClient } from './google/google-oauth.client';
import { GoogleOAuthService } from './google/google-oauth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
    JwtModule.register({}),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'auth',
            ttl: Number(configService.get('AUTH_THROTTLE_TTL_MS') ?? 60_000),
            limit: Number(configService.get('AUTH_THROTTLE_LIMIT') ?? 5),
          },
        ],
      }),
    }),
    forwardRef(() => PortfoliosModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleOAuthClient,
    GoogleOAuthService,
    JwtStrategy,
    JwtAuthGuard,
  ],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
