import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import { DATABASE, type Database } from '../../database/database.types';
import { assetCandles, assets, type Asset } from '../../database/schema';
import { MarketDataService } from '../market-data/market-data.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 365;

@Injectable()
export class CandleSyncService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly marketData: MarketDataService,
  ) {}

  needsSync(asset: Asset, now = Date.now()): boolean {
    if (!asset.candlesSyncedAt) {
      return true;
    }

    return now - asset.candlesSyncedAt.getTime() >= DAY_MS;
  }

  async sync(asset: Asset, now = new Date()): Promise<void> {
    const from = new Date(now.getTime() - HISTORY_DAYS * DAY_MS);
    const candles = await this.marketData.getPriceHistory(asset, {
      interval: '1d',
      from: from.toISOString(),
      to: now.toISOString(),
    });
    const rows = candles.flatMap((candle) => {
      const open = decimal(candle.open);
      const high = decimal(candle.high);
      const low = decimal(candle.low);
      const close = decimal(candle.close);
      const bucket = new Date(candle.timestamp);

      if (!open || !high || !low || !close || Number.isNaN(bucket.getTime())) {
        return [];
      }

      return [
        {
          assetId: asset.id,
          interval: '1d',
          bucket,
          open,
          high,
          low,
          close,
          volume: candle.volume === null ? null : decimal(candle.volume),
        },
      ];
    });

    if (rows.length > 0) {
      await this.database
        .insert(assetCandles)
        .values(rows)
        .onConflictDoUpdate({
          target: [assetCandles.assetId, assetCandles.interval, assetCandles.bucket],
          set: {
            open: sql`excluded.open`,
            high: sql`excluded.high`,
            low: sql`excluded.low`,
            close: sql`excluded.close`,
            volume: sql`excluded.volume`,
          },
        });
    }

    await this.database
      .update(assets)
      .set({ candlesSyncedAt: now })
      .where(eq(assets.id, asset.id));
  }
}

function decimal(value: number): string | null {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return value.toFixed(12).replace(/\.?0+$/, '') || '0';
}
