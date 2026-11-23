import type { Asset } from '../database/schema';
import type { CachedPrice } from '../portfolios/valuation/valuation.types';
import { PRICE_STALE_AFTER_MS } from '../prices/ingestion/price-policy';

export type AssetResponse = {
  id: string;
  symbol: string;
  name: string;
  assetType: Asset['assetType'];
  externalProvider: string;
  externalId: string;
  status: Asset['status'];
};

export type AssetQuote = {
  currency: 'USD';
  price: string | null;
  priceAsOf: string | null;
  stale: boolean;
  change24h: string | null;
  changePercent24h: string | null;
  volume24h: string | null;
  high24h: string | null;
  low24h: string | null;
};

export function toAssetResponse(asset: Asset): AssetResponse {
  return {
    id: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    assetType: asset.assetType,
    externalProvider: asset.externalProvider,
    externalId: asset.externalId,
    status: asset.status,
  };
}

export function toQuote(cached: CachedPrice | undefined, now = Date.now()): AssetQuote {
  const stale =
    !cached || now - cached.asOf.getTime() > PRICE_STALE_AFTER_MS;

  return {
    currency: 'USD',
    price: cached?.price ?? null,
    priceAsOf: cached ? cached.asOf.toISOString() : null,
    stale,
    change24h: cached?.change24h ?? null,
    changePercent24h: cached?.changePercent24h ?? null,
    volume24h: cached?.volume24h ?? null,
    high24h: cached?.high24h ?? null,
    low24h: cached?.low24h ?? null,
  };
}
