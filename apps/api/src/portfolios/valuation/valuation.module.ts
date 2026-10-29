import { Module } from '@nestjs/common';

import { PricesModule } from '../../prices';
import { PortfolioValuationService } from './portfolio-valuation.service';

@Module({
  imports: [PricesModule],
  providers: [PortfolioValuationService],
  exports: [PortfolioValuationService],
})
export class ValuationModule {}
