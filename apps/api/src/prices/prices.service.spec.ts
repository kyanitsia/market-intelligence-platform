import { PricesService } from './prices.service';
import type { MarketDataService } from './market-data/market-data.service';
import type { PriceSnapshot } from './market-data/market-data';
import type { Asset } from '../database/schema';

describe('PricesService', () => {
  const asset: Asset = {
    id: 'asset-id',
    symbol: 'BTC',
    name: 'Bitcoin',
    assetType: 'CRYPTO',
    externalProvider: 'coingecko',
    externalId: 'bitcoin',
    status: 'ACTIVE',
  };

  const asOf = new Date();
  const freshFor = 15 * 60 * 1000;

  function snapshot(price: number, fetchedAt = asOf): PriceSnapshot {
    return {
      assetId: asset.id,
      symbol: asset.symbol,
      price,
      currency: 'USD',
      change24h: null,
      changePercent24h: null,
      volume24h: null,
      high24h: null,
      low24h: null,
      source: 'coingecko',
      fetchedAt: fetchedAt.toISOString(),
    };
  }

  it('returns the latest cached price without fetching', async () => {
    const select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest
          .fn()
          .mockResolvedValue([{ assetId: asset.id, price: '65000', asOf }]),
      }),
    });
    const marketData = { getLatestPrices: jest.fn() };
    const service = new PricesService(
      { select, insert: jest.fn() } as never,
      marketData as unknown as MarketDataService,
    );

    await expect(
      service.getLatestForAssets([asset], 'USD', freshFor),
    ).resolves.toEqual(new Map([[asset.id, { price: '65000', asOf }]]));
    expect(marketData.getLatestPrices).not.toHaveBeenCalled();
  });

  it('fetches and caches quotes only when a price is missing', async () => {
    const select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });
    const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({ onConflictDoUpdate }),
    });
    const marketData = {
      getLatestPrices: jest.fn().mockResolvedValue([snapshot(65000)]),
    };
    const service = new PricesService(
      { select, insert } as never,
      marketData as unknown as MarketDataService,
    );

    await expect(
      service.getLatestForAssets([asset], 'USD', freshFor),
    ).resolves.toEqual(new Map([[asset.id, { price: '65000', asOf }]]));
    expect(marketData.getLatestPrices).toHaveBeenCalledWith([asset]);
    expect(onConflictDoUpdate).toHaveBeenCalled();
  });

  it('does not store a USD quote as another currency', async () => {
    const select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });
    const marketData = { getLatestPrices: jest.fn() };
    const service = new PricesService(
      { select, insert: jest.fn() } as never,
      marketData as unknown as MarketDataService,
    );

    await expect(
      service.getLatestForAssets([asset], 'EUR', freshFor),
    ).resolves.toEqual(new Map());
    expect(marketData.getLatestPrices).not.toHaveBeenCalled();
  });

  it('refetches a cached price older than the stale window', async () => {
    const staleAsOf = new Date(Date.now() - freshFor - 1);
    const freshAsOf = new Date();
    const select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([
          { assetId: asset.id, price: '60000', asOf: staleAsOf },
        ]),
      }),
    });
    const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({ onConflictDoUpdate }),
    });
    const marketData = {
      getLatestPrices: jest.fn().mockResolvedValue([snapshot(65000, freshAsOf)]),
    };
    const service = new PricesService(
      { select, insert } as never,
      marketData as unknown as MarketDataService,
    );

    await expect(
      service.getLatestForAssets([asset], 'USD', freshFor),
    ).resolves.toEqual(
      new Map([[asset.id, { price: '65000', asOf: freshAsOf }]]),
    );
    expect(marketData.getLatestPrices).toHaveBeenCalledWith([asset]);
  });
});
