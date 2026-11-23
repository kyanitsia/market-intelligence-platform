import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';

import { BrokerService } from '../../broker/broker.service';
import {
  NOTIFICATIONS_QUEUE,
  NOTIFICATIONS_ROUTING_KEY,
  PRICE_ALERTS_QUEUE,
  PRICE_UPDATES_QUEUE,
} from '../../broker/broker.constants';
import { DATABASE, type Database } from '../../database/database.types';
import { assets, type Asset } from '../../database/schema';
import { AlertEvaluationService } from '../alerts/alert-evaluation.service';
import { MarketDataError, type PriceSnapshot } from '../market-data/market-data';
import { PriceCache } from './price-cache';
import { cacheTtlSeconds, pollIntervalMs } from './price-policy';
import { parseNotificationMessage, parsePriceSnapshot } from './price-message';
import { CandleSyncService } from './candle-sync.service';
import { PricesService } from '../prices.service';

@Injectable()
export class PricePipelineService implements OnModuleInit {
  private readonly logger = new Logger(PricePipelineService.name);

  constructor(
    private readonly broker: BrokerService,
    private readonly cache: PriceCache,
    private readonly prices: PricesService,
    private readonly candles: CandleSyncService,
    private readonly alerts: AlertEvaluationService,
    private readonly config: ConfigService,
    @Inject(DATABASE) private readonly database: Database,
  ) {}

  onModuleInit(): void {
    this.broker.consume(PRICE_UPDATES_QUEUE, (body) =>
      this.persist(parsePriceSnapshot(body)),
    );
    this.broker.consume(PRICE_ALERTS_QUEUE, (body) =>
      this.fanoutAlerts(parsePriceSnapshot(body)),
    );
    this.broker.consume(NOTIFICATIONS_QUEUE, (body) =>
      this.alerts.store(parseNotificationMessage(body)),
    );
  }

  async persist(snapshot: PriceSnapshot): Promise<void> {
    const asset = await this.loadAsset(snapshot.assetId);

    if (!asset) {
      this.logger.warn(
        `Dropping price update for unknown asset ${snapshot.assetId}`,
      );
      return;
    }

    const ttl = cacheTtlSeconds(
      pollIntervalMs(this.config.get('MARKET_DATA_POLL_INTERVAL_MS')),
    );

    await this.cache.write(snapshot, ttl);
    await this.prices.remember(snapshot);

    if (!this.candles.needsSync(asset)) {
      return;
    }

    try {
      await this.candles.sync(asset);
    } catch (error: unknown) {
      this.logger.warn(
        `Candle sync failed for ${asset.symbol}: ${failureText(error)}`,
      );
    }
  }

  async fanoutAlerts(snapshot: PriceSnapshot): Promise<void> {
    const messages = await this.alerts.plan(snapshot);

    for (const message of messages) {
      await this.broker.publish(NOTIFICATIONS_ROUTING_KEY, message);
    }
  }

  private async loadAsset(assetId: string): Promise<Asset | null> {
    const [asset] = await this.database
      .select()
      .from(assets)
      .where(eq(assets.id, assetId))
      .limit(1);

    return asset ?? null;
  }
}

function failureText(error: unknown): string {
  if (error instanceof MarketDataError || error instanceof Error) {
    return error.message;
  }

  return 'request failed';
}
