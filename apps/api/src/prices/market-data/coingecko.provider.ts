import { Injectable } from '@nestjs/common';

import type { Asset } from '../../database/schema';
import { hitsFromCoinGecko, type CatalogHit } from '../../market/asset-search';
import {
  candlesFromPoints,
  fetchMarketJson,
  finiteNumber,
  MarketDataError,
  unixRange,
  type Candle,
  type MarketDataProvider,
  type PriceRange,
  type PriceSnapshot,
} from './market-data';

type CoinMarket = {
  current_price?: number;
  price_change_24h?: number;
  price_change_percentage_24h?: number;
  total_volume?: number;
  high_24h?: number;
  low_24h?: number;
};

type MarketChart = {
  prices?: Array<[number, number]>;
  total_volumes?: Array<[number, number]>;
};

const COINGECKO_PUBLIC_API = 'https://api.coingecko.com/api/v3';
const COINGECKO_PUBLIC_HISTORY_DAYS = 365;

@Injectable()
export class CoinGeckoProvider implements MarketDataProvider {
  async getLatestPrice(asset: Asset): Promise<PriceSnapshot> {
    this.assertCrypto(asset);

    const url = new URL(`${COINGECKO_PUBLIC_API}/coins/markets`);
    url.searchParams.set('vs_currency', 'usd');
    url.searchParams.set('ids', asset.externalId);

    const rows = await fetchMarketJson<CoinMarket[]>('coingecko', url.toString());

    if (!Array.isArray(rows)) {
      throw new MarketDataError('coingecko', 'Unexpected CoinGecko response');
    }

    const row = rows[0];
    const price = finiteNumber(row?.current_price);

    if (price === null || price < 0) {
      throw new MarketDataError(
        'coingecko',
        `No CoinGecko price for ${asset.externalId}`,
      );
    }

    return {
      assetId: asset.id,
      symbol: asset.symbol,
      price,
      currency: 'USD',
      change24h: finiteNumber(row?.price_change_24h),
      changePercent24h: finiteNumber(row?.price_change_percentage_24h),
      volume24h: finiteNumber(row?.total_volume),
      high24h: finiteNumber(row?.high_24h),
      low24h: finiteNumber(row?.low_24h),
      source: 'coingecko',
      fetchedAt: new Date().toISOString(),
    };
  }

  async getPriceHistory(asset: Asset, range: PriceRange): Promise<Candle[]> {
    this.assertCrypto(asset);
    const { from, to } = unixRange('coingecko', range);
    const days = Math.min(
      COINGECKO_PUBLIC_HISTORY_DAYS,
      Math.max(1, Math.ceil((Date.now() / 1000 - from) / 86_400)),
    );
    const url = new URL(
      `${COINGECKO_PUBLIC_API}/coins/${encodeURIComponent(asset.externalId)}/market_chart`,
    );
    url.searchParams.set('vs_currency', 'usd');
    url.searchParams.set('days', String(days));

    const chart = await fetchMarketJson<MarketChart>('coingecko', url.toString());
    const fromMs = from * 1000;
    const toMs = to * 1000;

    return candlesFromPoints(
      asset.id,
      range.interval,
      (chart.prices ?? []).filter(([time]) => time >= fromMs && time <= toMs),
      (chart.total_volumes ?? []).filter(
        ([time]) => time >= fromMs && time <= toMs,
      ),
    );
  }

  async search(query: string): Promise<CatalogHit[]> {
    const url = new URL(`${COINGECKO_PUBLIC_API}/search`);
    url.searchParams.set('query', query);
    const payload = await fetchMarketJson<{ coins?: Array<{ id?: string; symbol?: string; name?: string }> }>(
      'coingecko',
      url.toString(),
    );

    return hitsFromCoinGecko(payload.coins ?? []);
  }

  private assertCrypto(asset: Asset): void {
    if (asset.assetType !== 'CRYPTO') {
      throw new MarketDataError(
        'coingecko',
        'CoinGecko supports CRYPTO assets only',
      );
    }
  }

}
