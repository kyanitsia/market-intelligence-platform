import { DEFAULT_QUOTE_TIMEOUT_MS } from '../prices.constants';
import type { Asset } from '../../database/schema';

export type MarketDataSource = 'coingecko' | 'finnhub';

export type CandleInterval = '1d' | '1w';

export interface PriceRange {
  interval: CandleInterval;
  from: string;
  to: string;
}

export interface PriceSnapshot {
  assetId: string;
  symbol: string;
  price: number;
  currency: 'USD';
  change24h: number | null;
  changePercent24h: number | null;
  volume24h: number | null;
  high24h: number | null;
  low24h: number | null;
  source: MarketDataSource;
  fetchedAt: string;
}

export interface Candle {
  assetId: string;
  interval: CandleInterval;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface MarketDataProvider {
  getLatestPrice(asset: Asset): Promise<PriceSnapshot>;
  getPriceHistory(asset: Asset, range: PriceRange): Promise<Candle[]>;
}

export class MarketDataError extends Error {
  constructor(
    readonly source: MarketDataSource,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'MarketDataError';
  }
}

export function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function unixRange(
  source: MarketDataSource,
  range: PriceRange,
): { from: number; to: number } {
  const fromMs = Date.parse(range.from);
  const toMs = Date.parse(range.to);

  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs) {
    throw new MarketDataError(source, 'Price range must be a valid from/to interval');
  }

  return {
    from: Math.floor(fromMs / 1000),
    to: Math.floor(toMs / 1000),
  };
}

const MAX_FETCH_ATTEMPTS = 3;

export function retryDelayMs(attempt: number): number {
  const ceiling = 200 * 2 ** attempt;
  return ceiling + Math.floor(Math.random() * ceiling);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchMarketJson<T>(
  source: MarketDataSource,
  url: string,
  headers?: Record<string, string>,
  sleep: (ms: number) => Promise<void> = delay,
): Promise<T> {
  let lastError: MarketDataError | undefined;

  for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await requestMarketJson<T>(source, url, headers);
    } catch (error: unknown) {
      lastError = asMarketDataError(source, error);

      if (attempt === MAX_FETCH_ATTEMPTS - 1 || !isTransient(lastError)) {
        throw lastError;
      }

      await sleep(retryDelayMs(attempt));
    }
  }

  throw lastError ?? new MarketDataError(source, `${source} request failed`);
}

async function requestMarketJson<T>(
  source: MarketDataSource,
  url: string,
  headers?: Record<string, string>,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'market-intelligence-platform/1.0',
        ...headers,
      },
      signal: AbortSignal.timeout(DEFAULT_QUOTE_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    throw asMarketDataError(source, error);
  }

  if (!response.ok) {
    throw new MarketDataError(
      source,
      `${source} request failed (${response.status})`,
      response.status,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new MarketDataError(source, `${source} returned invalid JSON`);
  }
}

function asMarketDataError(source: MarketDataSource, error: unknown): MarketDataError {
  if (error instanceof MarketDataError) {
    return error;
  }

  const name = error instanceof Error ? error.name : '';

  if (name === 'TimeoutError' || name === 'AbortError') {
    return new MarketDataError(source, `${source} request timed out`);
  }

  return new MarketDataError(source, `${source} request failed`);
}

function isTransient(error: MarketDataError): boolean {
  if (error.status === 429 || error.status === 408) {
    return true;
  }

  if (error.status !== undefined && error.status >= 500) {
    return true;
  }

  return error.status === undefined && error.message.endsWith('timed out');
}

type PricePoint = [number, number];

export function candlesFromPoints(
  assetId: string,
  interval: CandleInterval,
  prices: PricePoint[],
  volumes: PricePoint[],
): Candle[] {
  const volumeAt = new Map(volumes);
  const buckets = new Map<
    number,
    {
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      hasVolume: boolean;
    }
  >();

  for (const [time, price] of prices) {
    if (!Number.isFinite(time) || !Number.isFinite(price)) {
      continue;
    }

    const start = bucketStart(time, interval);
    const volume = volumeAt.get(time);
    const hasPointVolume = typeof volume === 'number' && Number.isFinite(volume);
    const existing = buckets.get(start);

    if (!existing) {
      buckets.set(start, {
        open: price,
        high: price,
        low: price,
        close: price,
        volume: hasPointVolume ? volume : 0,
        hasVolume: hasPointVolume,
      });
      continue;
    }

    existing.high = Math.max(existing.high, price);
    existing.low = Math.min(existing.low, price);
    existing.close = price;

    if (hasPointVolume) {
      existing.volume += volume;
      existing.hasVolume = true;
    }
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([start, candle]) => ({
      assetId,
      interval,
      timestamp: new Date(start).toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.hasVolume ? candle.volume : null,
    }));
}

function bucketStart(timeMs: number, interval: CandleInterval): number {
  const date = new Date(timeMs);

  if (interval === '1d') {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? 6 : day - 1;

  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - mondayOffset,
  );
}
