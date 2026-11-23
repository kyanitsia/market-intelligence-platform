import type { Asset } from '../../database/schema';

export const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;
export const DEFAULT_CACHE_TTL_SECONDS = 900;
export const PRICE_STALE_AFTER_MS = 15 * 60 * 1000;
export const PRICE_POLL_JOB = 'market-data-poll';

export function pollIntervalMs(raw: unknown): number {
  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed >= 1000
    ? parsed
    : DEFAULT_POLL_INTERVAL_MS;
}

/** TTL follows the poll interval and never expires before the next poll. */
export function cacheTtlSeconds(intervalMs: number): number {
  return Math.max(DEFAULT_CACHE_TTL_SECONDS, Math.ceil(intervalMs / 1000));
}

export function isPriceStale(fetchedAt: string, now = Date.now()): boolean {
  const fetched = Date.parse(fetchedAt);

  return Number.isNaN(fetched) || now - fetched > PRICE_STALE_AFTER_MS;
}

export function uniqueAssets(assets: Asset[]): Asset[] {
  return [...new Map(assets.map((asset) => [asset.id, asset])).values()];
}

/** CoinGecko's keyless API is about 5 calls/min. Finnhub's free tier is about 60. */
export function providerGapMs(assetType: Asset['assetType']): number {
  return assetType === 'CRYPTO' ? 12_000 : 1_000;
}

export function priceKey(assetId: string): string {
  return `price:${assetId}`;
}
