import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DATABASE, type Database } from '../database/database.types';
import {
  assets,
  watchlistItems,
  watchlists,
  type Asset,
} from '../database/schema';
import { PricesService } from '../prices';
import { PRICE_STALE_AFTER_MS } from '../prices/ingestion/price-policy';
import { AssetsService } from './assets.service';
import {
  toAssetResponse,
  toQuote,
  type AssetQuote,
  type AssetResponse,
} from './asset-response';

export type WatchlistItemResponse = {
  id: string;
  createdAt: string;
  asset: AssetResponse;
  quote: AssetQuote;
};

export type WatchlistResponse = {
  id: string;
  name: string;
  items: WatchlistItemResponse[];
};

@Injectable()
export class WatchlistsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly assetsService: AssetsService,
    private readonly prices: PricesService,
  ) {}

  async listForUser(userId: string): Promise<WatchlistResponse[]> {
    const watchlist = await this.ensure(userId);
    const rows = await this.database
      .select({ itemId: watchlistItems.id, createdAt: watchlistItems.createdAt, asset: assets })
      .from(watchlistItems)
      .innerJoin(assets, eq(watchlistItems.assetId, assets.id))
      .where(eq(watchlistItems.watchlistId, watchlist.id));
    const quotes = await this.prices.getLatestForAssets(
      rows.map((row) => row.asset),
      'USD',
      PRICE_STALE_AFTER_MS,
    );

    return [
      {
        id: watchlist.id,
        name: watchlist.name,
        items: rows.map((row) => ({
          id: row.itemId,
          createdAt: row.createdAt.toISOString(),
          asset: toAssetResponse(row.asset),
          quote: toQuote(quotes.get(row.asset.id)),
        })),
      },
    ];
  }

  async addItem(
    userId: string,
    watchlistId: string,
    assetId: string,
  ): Promise<WatchlistItemResponse> {
    await this.owned(userId, watchlistId);
    const asset = await this.assetsService.requireAsset(assetId);

    await this.database
      .insert(watchlistItems)
      .values({ watchlistId, assetId: asset.id })
      .onConflictDoNothing();

    const [item] = await this.database
      .select()
      .from(watchlistItems)
      .where(
        and(
          eq(watchlistItems.watchlistId, watchlistId),
          eq(watchlistItems.assetId, asset.id),
        ),
      )
      .limit(1);

    if (!item) {
      throw new NotFoundException('Watchlist item not found');
    }

    return this.toItem(item.id, item.createdAt, asset);
  }

  async removeItem(
    userId: string,
    watchlistId: string,
    assetId: string,
  ): Promise<void> {
    await this.owned(userId, watchlistId);
    await this.database
      .delete(watchlistItems)
      .where(
        and(
          eq(watchlistItems.watchlistId, watchlistId),
          eq(watchlistItems.assetId, assetId),
        ),
      );
  }

  private async ensure(userId: string) {
    await this.database
      .insert(watchlists)
      .values({ userId, name: 'Watchlist' })
      .onConflictDoNothing({ target: watchlists.userId });

    const [watchlist] = await this.database
      .select()
      .from(watchlists)
      .where(eq(watchlists.userId, userId))
      .limit(1);

    if (!watchlist) {
      throw new NotFoundException('Watchlist not found');
    }

    return watchlist;
  }

  private async owned(userId: string, watchlistId: string) {
    const [watchlist] = await this.database
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)))
      .limit(1);

    if (!watchlist) {
      throw new NotFoundException('Watchlist not found');
    }

    return watchlist;
  }

  private async toItem(
    id: string,
    createdAt: Date,
    asset: Asset,
  ): Promise<WatchlistItemResponse> {
    const quotes = await this.prices.getLatestForAssets(
      [asset],
      'USD',
      PRICE_STALE_AFTER_MS,
    );

    return {
      id,
      createdAt: createdAt.toISOString(),
      asset: toAssetResponse(asset),
      quote: toQuote(quotes.get(asset.id)),
    };
  }
}
