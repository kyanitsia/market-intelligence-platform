import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, ilike, or } from 'drizzle-orm';

import { DATABASE, type Database } from '../database/database.types';
import { assetCandles, assets, type Asset } from '../database/schema';
import { PricesService } from '../prices';
import { MarketDataService } from '../prices/market-data/market-data.service';
import { PRICE_STALE_AFTER_MS } from '../prices/ingestion/price-policy';
import type { CatalogHit } from './asset-search';
import { toAssetResponse, toQuote, type AssetQuote, type AssetResponse } from './asset-response';
import {
  downsample,
  priorClose,
  rangeStart,
  type ChartRange,
} from './chart-range';

export type CandlePoint = {
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string | null;
};

export type AssetHistory = {
  assetId: string;
  range: ChartRange;
  interval: '1d';
  candles: CandlePoint[];
  latest: AssetQuote;
  priorClose: string | null;
};

@Injectable()
export class AssetsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly marketData: MarketDataService,
    private readonly prices: PricesService,
  ) {}

  async search(query: string): Promise<AssetResponse[]> {
    const needle = query.trim().replace(/[%_]/g, '');

    if (needle.length < 2) {
      return [];
    }

    const local = await this.searchLocal(needle);
    const remote: Asset[] = [];

    for (const hit of await this.marketData.search(needle)) {
      remote.push(await this.saveHit(hit));
    }

    const merged = new Map<string, Asset>();

    for (const asset of [...local, ...remote]) {
      merged.set(asset.id, asset);
    }

    return [...merged.values()].slice(0, 10).map(toAssetResponse);
  }

  async findOne(assetId: string): Promise<AssetResponse> {
    return toAssetResponse(await this.requireAsset(assetId));
  }

  async stats(assetId: string): Promise<AssetResponse & { quote: AssetQuote }> {
    const asset = await this.requireAsset(assetId);

    return {
      ...toAssetResponse(asset),
      quote: await this.quoteFor(asset),
    };
  }

  async history(assetId: string, range: ChartRange): Promise<AssetHistory> {
    const asset = await this.requireAsset(assetId);
    const stored = await this.database
      .select()
      .from(assetCandles)
      .where(
        and(eq(assetCandles.assetId, asset.id), eq(assetCandles.interval, '1d')),
      )
      .orderBy(asc(assetCandles.bucket));
    const now = new Date();
    const window =
      range === '1D'
        ? []
        : stored.filter((candle) => candle.bucket >= rangeStart(range, now));

    return {
      assetId: asset.id,
      range,
      interval: '1d',
      candles: downsample(window).map((candle) => ({
        timestamp: candle.bucket.toISOString(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      })),
      latest: await this.quoteFor(asset),
      priorClose: priorClose(stored, now),
    };
  }

  async requireAsset(assetId: string): Promise<Asset> {
    const [asset] = await this.database
      .select()
      .from(assets)
      .where(eq(assets.id, assetId))
      .limit(1);

    if (!asset || asset.status !== 'ACTIVE') {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }

  private async quoteFor(asset: Asset): Promise<AssetQuote> {
    const prices = await this.prices.getLatestForAssets(
      [asset],
      'USD',
      PRICE_STALE_AFTER_MS,
    );

    return toQuote(prices.get(asset.id));
  }

  private async searchLocal(needle: string): Promise<Asset[]> {
    return this.database
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.status, 'ACTIVE'),
          or(
            ilike(assets.symbol, `${needle}%`),
            ilike(assets.name, `%${needle}%`),
          ),
        ),
      )
      .limit(10);
  }

  private async saveHit(hit: CatalogHit): Promise<Asset> {
    const existing = await this.findCatalogHit(hit);

    if (existing) {
      return existing;
    }

    const [created] = await this.database
      .insert(assets)
      .values({
        symbol: hit.symbol,
        name: hit.name,
        assetType: hit.assetType,
        externalProvider: hit.externalProvider,
        externalId: hit.externalId,
      })
      .onConflictDoNothing()
      .returning();

    const saved = created ?? (await this.findCatalogHit(hit));

    if (!saved) {
      throw new ConflictException('Could not save this asset');
    }

    return saved;
  }

  private async findCatalogHit(hit: CatalogHit): Promise<Asset | undefined> {
    const [byIdentity] = await this.database
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.externalProvider, hit.externalProvider),
          eq(assets.externalId, hit.externalId),
        ),
      )
      .limit(1);

    if (byIdentity) {
      return byIdentity;
    }

    const [bySymbol] = await this.database
      .select()
      .from(assets)
      .where(
        and(eq(assets.symbol, hit.symbol), eq(assets.assetType, hit.assetType)),
      )
      .limit(1);

    return bySymbol;
  }
}
