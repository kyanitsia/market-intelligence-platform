import { Injectable, Logger } from '@nestjs/common';

import type { Asset } from '../../database/schema';
import { CoinGeckoProvider } from './coingecko.provider';
import { FinnhubProvider } from './finnhub.provider';
import {
  MarketDataError,
  type Candle,
  type MarketDataProvider,
  type PriceRange,
  type PriceSnapshot,
} from './market-data';

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(
    private readonly coingecko: CoinGeckoProvider,
    private readonly finnhub: FinnhubProvider,
  ) {}

  getLatestPrice(asset: Asset): Promise<PriceSnapshot> {
    return this.providerFor(asset).getLatestPrice(asset);
  }

  getPriceHistory(asset: Asset, range: PriceRange): Promise<Candle[]> {
    return this.providerFor(asset).getPriceHistory(asset, range);
  }

  // ponytail: one request per asset; batch inside the provider if a refresh gets rate-limited
  async getLatestPrices(assets: Asset[]): Promise<PriceSnapshot[]> {
    const settled = await Promise.all(
      assets.map(async (asset) => {
        try {
          return await this.getLatestPrice(asset);
        } catch (error: unknown) {
          if (error instanceof MarketDataError) {
            this.logger.warn(error.message);
            return null;
          }

          throw error;
        }
      }),
    );

    return settled.filter((row): row is PriceSnapshot => row !== null);
  }

  private providerFor(asset: Asset): MarketDataProvider {
    if (asset.assetType === 'CRYPTO') {
      return this.coingecko;
    }

    if (asset.assetType === 'STOCK' || asset.assetType === 'ETF') {
      return this.finnhub;
    }

    throw new MarketDataError('finnhub', `Unsupported asset type ${asset.assetType}`);
  }
}
