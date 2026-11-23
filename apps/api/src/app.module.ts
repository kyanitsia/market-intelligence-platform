import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { BrokerModule } from './broker/broker.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MarketModule } from './market/market.module';
import { PortfoliosModule } from './portfolios/portfolios.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),

    DatabaseModule,
    BrokerModule,
    HealthModule,
    AuthModule,
    UsersModule,
    PortfoliosModule,
    MarketModule,
  ],
})
export class AppModule {}
