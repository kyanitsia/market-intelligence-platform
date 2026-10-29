import { Module } from '@nestjs/common';

import { ValuationModule } from '../valuation';
import { HoldingsController } from './holdings.controller';
import { HoldingsService } from './holdings.service';
import { TransactionsController } from '../transactions/transactions.controller';
import { TransactionsService } from '../transactions/transactions.service';

@Module({
  imports: [ValuationModule],
  controllers: [HoldingsController, TransactionsController],
  providers: [HoldingsService, TransactionsService],
})
export class HoldingsModule {}
