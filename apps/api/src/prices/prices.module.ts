import { Module } from '@nestjs/common';

import { CoinGeckoProvider } from './market-data/coingecko.provider';
import { FinnhubProvider } from './market-data/finnhub.provider';
import { MarketDataService } from './market-data/market-data.service';
import { PricesService } from './prices.service';

@Module({
  providers: [
    PricesService,
    MarketDataService,
    CoinGeckoProvider,
    FinnhubProvider,
  ],
  exports: [PricesService, MarketDataService],
})
export class PricesModule {}
