import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { DATABASE, type Database } from '../database/database.types';
import { assetPrices, type Asset } from '../database/schema';
import type { CachedPrice, Currency } from '../portfolios/valuation/valuation.types';
import type { PriceSnapshot } from './market-data/market-data';
import { PriceCache } from './ingestion/price-cache';

@Injectable()
export class PricesService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
    private readonly cache: PriceCache,
  ) {}

  /**
   * Latest quote for valuation. Reads Redis, then the last Postgres row.
   * Never calls a market-data provider.
   */
  async getLatestForAssets(
    assets: Asset[],
    currency: Currency,
    _staleAfterMs: number,
  ): Promise<Map<string, CachedPrice>> {
    if (assets.length === 0) {
      return new Map();
    }

    if (currency !== 'USD') {
      return this.loadStored(
        assets.map((asset) => asset.id),
        currency,
      );
    }

    const cached = await this.cache.readMany(assets.map((asset) => asset.id));
    const latest = new Map<string, CachedPrice>();

    for (const asset of assets) {
      const quote = fromSnapshot(cached.get(asset.id));

      if (quote) {
        latest.set(asset.id, quote);
      }
    }

    const missing = assets
      .filter((asset) => !latest.has(asset.id))
      .map((asset) => asset.id);
    const stored = await this.loadStored(missing, 'USD');

    for (const [assetId, quote] of stored) {
      latest.set(assetId, quote);
    }

    return latest;
  }

  async remember(snapshot: PriceSnapshot): Promise<void> {
    const price = decimalOrNull(snapshot.price);

    if (!price || price.startsWith('-')) {
      return;
    }

    const asOf = new Date(snapshot.fetchedAt);

    if (Number.isNaN(asOf.getTime())) {
      return;
    }

    await this.upsert([
      {
        assetId: snapshot.assetId,
        currency: snapshot.currency,
        price,
        asOf,
      },
    ]);
  }

  async upsert(
    rows: Array<{
      assetId: string;
      currency: Currency;
      price: string;
      asOf: Date;
    }>,
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await this.database
      .insert(assetPrices)
      .values(rows)
      .onConflictDoUpdate({
        target: [assetPrices.assetId, assetPrices.currency],
        set: {
          price: sql`excluded.price`,
          asOf: sql`excluded.as_of`,
        },
      });
  }

  private async loadStored(
    assetIds: string[],
    currency: Currency,
  ): Promise<Map<string, CachedPrice>> {
    const latest = new Map<string, CachedPrice>();

    if (assetIds.length === 0) {
      return latest;
    }

    const rows = await this.database
      .select({
        assetId: assetPrices.assetId,
        price: assetPrices.price,
        asOf: assetPrices.asOf,
      })
      .from(assetPrices)
      .where(
        and(
          inArray(assetPrices.assetId, assetIds),
          eq(assetPrices.currency, currency),
        ),
      );

    for (const row of rows) {
      latest.set(row.assetId, {
        price: row.price,
        asOf: row.asOf,
      });
    }

    return latest;
  }
}

function fromSnapshot(
  snapshot: (PriceSnapshot & { stale?: boolean }) | undefined,
): CachedPrice | null {
  if (!snapshot) {
    return null;
  }

  const price = decimalOrNull(snapshot.price);
  const asOf = new Date(snapshot.fetchedAt);

  if (!price || price.startsWith('-') || Number.isNaN(asOf.getTime())) {
    return null;
  }

  return {
    price,
    asOf,
    change24h: decimalOrNull(snapshot.change24h),
    changePercent24h: decimalOrNull(snapshot.changePercent24h),
    volume24h: decimalOrNull(snapshot.volume24h),
    high24h: decimalOrNull(snapshot.high24h),
    low24h: decimalOrNull(snapshot.low24h),
  };
}

function decimalOrNull(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  const text = Math.abs(value).toFixed(12).replace(/\.?0+$/, '') || '0';
  return value < 0 ? `-${text}` : text;
}
