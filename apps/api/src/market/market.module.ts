import { Module } from '@nestjs/common';

import { PricesModule } from '../prices';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { PriceAlertsController } from './price-alerts.controller';
import { PriceAlertsService } from './price-alerts.service';
import { WatchlistsController } from './watchlists.controller';
import { WatchlistsService } from './watchlists.service';

@Module({
  imports: [PricesModule],
  controllers: [AssetsController, WatchlistsController, PriceAlertsController],
  providers: [AssetsService, WatchlistsService, PriceAlertsService],
})
export class MarketModule {}
