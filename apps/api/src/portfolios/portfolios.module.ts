import { Module } from '@nestjs/common';

import { HoldingsModule } from './holdings/holdings.module';
import { PortfoliosController } from './portfolios.controller';
import { PortfoliosService } from './portfolios.service';
import { ValuationModule } from './valuation';

@Module({
  imports: [HoldingsModule, ValuationModule],
  controllers: [PortfoliosController],
  providers: [PortfoliosService],
  exports: [PortfoliosService],
})
export class PortfoliosModule {}
