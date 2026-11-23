import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import Redis from 'ioredis';

import { CoinGeckoProvider } from './market-data/coingecko.provider';
import { FinnhubProvider } from './market-data/finnhub.provider';
import { MarketDataService } from './market-data/market-data.service';
import { AlertEvaluationService } from './alerts/alert-evaluation.service';
import { CandleSyncService } from './ingestion/candle-sync.service';
import { PriceCache, REDIS, type RedisLike } from './ingestion/price-cache';
import { PriceIngestionService } from './ingestion/price-ingestion.service';
import { PricePipelineService } from './ingestion/price-pipeline.service';
import { PricesService } from './prices.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    PricesService,
    MarketDataService,
    CoinGeckoProvider,
    FinnhubProvider,
    PriceCache,
    CandleSyncService,
    AlertEvaluationService,
    PriceIngestionService,
    PricePipelineService,
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<RedisLike> => {
        const client = new Redis(
          config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
          {
            maxRetriesPerRequest: 2,
            lazyConnect: true,
            enableOfflineQueue: false,
          },
        );

        try {
          await client.connect();
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : 'request failed';
          new Logger('Redis').warn(`Redis price cache unavailable: ${message}`);
        }

        return client as unknown as RedisLike;
      },
    },
  ],
  exports: [PricesService, MarketDataService, PriceCache],
})
export class PricesModule {}
