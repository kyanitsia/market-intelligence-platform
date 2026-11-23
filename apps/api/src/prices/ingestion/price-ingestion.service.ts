import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { and, eq, isNull } from 'drizzle-orm';

import { BrokerService } from '../../broker/broker.service';
import { PRICE_UPDATES_ROUTING_KEY } from '../../broker/broker.constants';
import { DATABASE, type Database } from '../../database/database.types';
import {
  assets,
  holdings,
  portfolios,
  priceAlerts,
  watchlistItems,
  watchlists,
  type Asset,
} from '../../database/schema';
import { MarketDataError } from '../market-data/market-data';
import { MarketDataService } from '../market-data/market-data.service';
import {
  pollIntervalMs,
  PRICE_POLL_JOB,
  providerGapMs,
  uniqueAssets,
} from './price-policy';

@Injectable()
export class PriceIngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PriceIngestionService.name);
  private running = false;

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly marketData: MarketDataService,
    private readonly broker: BrokerService,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const handle = setInterval(() => {
      void this.poll();
    }, this.intervalMs());

    this.scheduler.addInterval(PRICE_POLL_JOB, handle);
    void this.poll();
  }

  onModuleDestroy(): void {
    if (this.scheduler.doesExist('interval', PRICE_POLL_JOB)) {
      this.scheduler.deleteInterval(PRICE_POLL_JOB);
    }
  }

  intervalMs(): number {
    return pollIntervalMs(this.config.get('MARKET_DATA_POLL_INTERVAL_MS'));
  }

  async poll(): Promise<void> {
    if (this.running) {
      this.logger.warn('Skipping price poll; previous run still active');
      return;
    }

    this.running = true;
    let stored = 0;
    let failed = 0;
    const lastCall = new Map<string, number>();

    try {
      const relevant = uniqueAssets(await this.loadRelevantAssets());

      for (const asset of relevant) {
        await this.pace(asset, lastCall);

        try {
          const snapshot = await this.marketData.getLatestPrice(asset);
          await this.broker.publish(PRICE_UPDATES_ROUTING_KEY, snapshot);
          stored += 1;
        } catch (error: unknown) {
          failed += 1;
          this.logger.warn(
            `Price ingest failed for ${asset.symbol}: ${failureText(error)}`,
          );
        }
      }

      this.logger.log(
        `Price ingest finished: ${stored} stored, ${failed} failed`,
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * Held, watchlisted, or covered by an active price alert.
   */
  async loadRelevantAssets(): Promise<Asset[]> {
    const held = await this.database
      .select({ asset: assets })
      .from(holdings)
      .innerJoin(assets, eq(holdings.assetId, assets.id))
      .innerJoin(portfolios, eq(holdings.portfolioId, portfolios.id))
      .where(and(isNull(portfolios.deletedAt), eq(assets.status, 'ACTIVE')));
    const watched = await this.database
      .select({ asset: assets })
      .from(watchlistItems)
      .innerJoin(watchlists, eq(watchlistItems.watchlistId, watchlists.id))
      .innerJoin(assets, eq(watchlistItems.assetId, assets.id))
      .where(eq(assets.status, 'ACTIVE'));
    const alerted = await this.database
      .select({ asset: assets })
      .from(priceAlerts)
      .innerJoin(assets, eq(priceAlerts.assetId, assets.id))
      .where(and(eq(priceAlerts.active, true), eq(assets.status, 'ACTIVE')));

    return uniqueAssets(
      [...held, ...watched, ...alerted].map((row) => row.asset),
    );
  }

  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async pace(
    asset: Asset,
    lastCall: Map<string, number>,
  ): Promise<void> {
    const provider = asset.assetType === 'CRYPTO' ? 'coingecko' : 'finnhub';
    const gap = providerGapMs(asset.assetType);
    const elapsed = Date.now() - (lastCall.get(provider) ?? 0);

    if (lastCall.has(provider) && elapsed < gap) {
      await this.delay(gap - elapsed);
    }

    lastCall.set(provider, Date.now());
  }
}

function failureText(error: unknown): string {
  if (error instanceof MarketDataError || error instanceof Error) {
    return error.message;
  }

  return 'request failed';
}
