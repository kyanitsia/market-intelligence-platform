import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { DATABASE, type Database } from '../database/database.types';
import { assetPrices, type Asset } from '../database/schema';
import type {
  CachedPrice,
  Currency,
} from '../portfolios/valuation/valuation.types';
import { MarketDataService } from './market-data/market-data.service';

@Injectable()
export class PricesService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
    private readonly marketData: MarketDataService,
  ) {}

  async getLatestForAssets(
    assets: Asset[],
    currency: Currency,
    staleAfterMs: number,
  ): Promise<Map<string, CachedPrice>> {
    const latest = await this.loadCached(
      assets.map((asset) => asset.id),
      currency,
    );
    const now = Date.now();
    // ponytail: refetches on the next read once the cached fetch is past the window
    const due = assets.filter((asset) => {
      const cached = latest.get(asset.id);

      return !cached || now - cached.asOf.getTime() > staleAfterMs;
    });

    if (due.length === 0 || currency !== 'USD') {
      return latest;
    }

    const fetched = (await this.marketData.getLatestPrices(due)).flatMap(
      (snapshot) => {
        const price = priceToDecimal(snapshot.price);

        if (!price) {
          return [];
        }

        return [
          {
            assetId: snapshot.assetId,
            price,
            asOf: new Date(snapshot.fetchedAt),
          },
        ];
      },
    );

    if (fetched.length === 0) {
      return latest;
    }

    await this.upsert(
      fetched.map((quote) => ({
        assetId: quote.assetId,
        currency,
        price: quote.price,
        asOf: quote.asOf,
      })),
    );

    for (const quote of fetched) {
      latest.set(quote.assetId, {
        price: quote.price,
        asOf: quote.asOf,
      });
    }

    return latest;
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

  private async loadCached(
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

function priceToDecimal(price: number): string | null {
  if (!Number.isFinite(price) || price < 0) {
    return null;
  }

  return price.toFixed(12).replace(/\.?0+$/, '') || '0';
}
