import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Asset } from '../../database/schema';
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

type FinnhubCandles = {
  s?: string;
  c?: number[];
  h?: number[];
  l?: number[];
  o?: number[];
  t?: number[];
  v?: number[];
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
    const payload = await fetchMarketJson<FinnhubCandles>(
      'finnhub',
      this.url('/stock/candle', {
        symbol: asset.symbol,
        resolution: range.interval === '1w' ? 'W' : 'D',
        from: String(from),
        to: String(to),
      }),
    );

    if (payload.s === 'no_data') {
      return [];
    }

    if (payload.s !== 'ok') {
      throw new MarketDataError(
        'finnhub',
        `Finnhub history failed for ${asset.symbol}`,
      );
    }

    return toCandles(asset.id, range.interval, payload);
  }

  private assertListed(asset: Asset): void {
    if (asset.assetType !== 'STOCK' && asset.assetType !== 'ETF') {
      throw new MarketDataError(
        'finnhub',
        'Finnhub supports STOCK and ETF assets only',
      );
    }
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
  payload: FinnhubCandles,
): Candle[] {
  const times = payload.t ?? [];
  const candles: Candle[] = [];

  for (const [index, time] of times.entries()) {
    const open = finiteNumber(payload.o?.[index]);
    const high = finiteNumber(payload.h?.[index]);
    const low = finiteNumber(payload.l?.[index]);
    const close = finiteNumber(payload.c?.[index]);

    if (
      !Number.isFinite(time) ||
      open === null ||
      high === null ||
      low === null ||
      close === null
    ) {
      continue;
    }

    const volume = payload.v?.[index];

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
