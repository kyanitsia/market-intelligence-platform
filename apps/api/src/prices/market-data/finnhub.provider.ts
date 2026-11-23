import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Asset } from '../../database/schema';
import { hitsFromFinnhub, type CatalogHit } from '../../market/asset-search';
import {
  fetchMarketJson,
  finiteNumber,
  MarketDataError,
  unixRange,
  type Candle,
  type CandleInterval,
  type MarketDataProvider,
  type PriceRange,
  type PriceSnapshot,
} from './market-data';

type FinnhubQuote = {
  c?: number;
  d?: number;
  dp?: number;
  h?: number;
  l?: number;
};

type YahooChart = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

@Injectable()
export class FinnhubProvider implements MarketDataProvider {
  constructor(private readonly config: ConfigService) {}

  async getLatestPrice(asset: Asset): Promise<PriceSnapshot> {
    this.assertListed(asset);
    const quote = await fetchMarketJson<FinnhubQuote>(
      'finnhub',
      this.url('/quote', { symbol: asset.symbol }),
    );
    const price = finiteNumber(quote.c);

    if (price === null || price <= 0) {
      throw new MarketDataError('finnhub', `No Finnhub price for ${asset.symbol}`);
    }

    return {
      assetId: asset.id,
      symbol: asset.symbol,
      price,
      currency: 'USD',
      change24h: finiteNumber(quote.d),
      changePercent24h: finiteNumber(quote.dp),
      volume24h: null,
      high24h: finiteNumber(quote.h),
      low24h: finiteNumber(quote.l),
      source: 'finnhub',
      fetchedAt: new Date().toISOString(),
    };
  }

  async getPriceHistory(asset: Asset, range: PriceRange): Promise<Candle[]> {
    this.assertListed(asset);
    const { from, to } = unixRange('finnhub', range);
    const url = new URL(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.symbol)}`,
    );
    url.searchParams.set('period1', String(from));
    url.searchParams.set('period2', String(to));
    url.searchParams.set('interval', range.interval === '1w' ? '1wk' : '1d');

    const payload = await fetchMarketJson<YahooChart>('finnhub', url.toString());
    const series = payload.chart?.result?.[0];
    const quote = series?.indicators?.quote?.[0];

    if (!series?.timestamp || !quote) {
      throw new MarketDataError('finnhub', `No stock history for ${asset.symbol}`);
    }

    return toCandles(asset.id, range.interval, series.timestamp, quote);
  }

  private assertListed(asset: Asset): void {
    if (asset.assetType !== 'STOCK' && asset.assetType !== 'ETF') {
      throw new MarketDataError(
        'finnhub',
        'Finnhub supports STOCK and ETF assets only',
      );
    }
  }

  async search(query: string): Promise<CatalogHit[]> {
    const payload = await fetchMarketJson<{
      result?: Array<{ symbol?: string; description?: string; type?: string }>;
    }>('finnhub', this.url('/search', { q: query }));

    return hitsFromFinnhub(payload.result ?? []);
  }

  private url(path: string, params: Record<string, string>): string {
    const token = this.config.get<string>('FINNHUB_API_KEY')?.trim();

    if (!token) {
      throw new MarketDataError('finnhub', 'FINNHUB_API_KEY is not configured');
    }

    const base = (
      this.config.get<string>('FINNHUB_API_URL')?.trim() ||
      'https://finnhub.io/api/v1'
    ).replace(/\/$/, '');
    const url = new URL(`${base}${path}`);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    url.searchParams.set('token', token);
    return url.toString();
  }
}

function toCandles(
  assetId: string,
  interval: CandleInterval,
  times: number[],
  quote: {
    open?: Array<number | null>;
    high?: Array<number | null>;
    low?: Array<number | null>;
    close?: Array<number | null>;
    volume?: Array<number | null>;
  },
): Candle[] {
  const candles: Candle[] = [];

  for (const [index, time] of times.entries()) {
    const open = finiteNumber(quote.open?.[index]);
    const high = finiteNumber(quote.high?.[index]);
    const low = finiteNumber(quote.low?.[index]);
    const close = finiteNumber(quote.close?.[index]);

    if (
      !Number.isFinite(time) ||
      open === null ||
      high === null ||
      low === null ||
      close === null
    ) {
      continue;
    }

    const volume = quote.volume?.[index];

    candles.push({
      assetId,
      interval,
      timestamp: new Date(time * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume: typeof volume === 'number' && Number.isFinite(volume) ? volume : null,
    });
  }

  return candles;
}
