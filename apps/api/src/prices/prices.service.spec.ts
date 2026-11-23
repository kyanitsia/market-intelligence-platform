import { PricesService } from './prices.service';
import type { PriceCache } from './ingestion/price-cache';
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
    candlesSyncedAt: null,
  };

  const asOf = new Date('2026-11-17T10:00:00.000Z');
  const freshFor = 15 * 60 * 1000;

  function snapshot(price: number, fetchedAt = asOf): PriceSnapshot {
    return {
      assetId: asset.id,
      symbol: asset.symbol,
      price,
      currency: 'USD',
      change24h: -100,
      changePercent24h: 1.5,
      volume24h: 20,
      high24h: 66000,
      low24h: 64000,
      source: 'coingecko',
      fetchedAt: fetchedAt.toISOString(),
    };
  }

  function cacheOf(rows: PriceSnapshot[]): PriceCache {
    return {
      readMany: jest.fn(async () => {
        const found = new Map(
          rows.map((row) => [row.assetId, { ...row, stale: false }]),
        );
        return found;
      }),
    } as unknown as PriceCache;
  }

  function database(rows: Array<{ assetId: string; price: string; asOf: Date }>) {
    const select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(rows),
      }),
    });

    return { select, insert: jest.fn() };
  }

  it('returns the redis snapshot and does not read postgres', async () => {
    const db = database([]);
    const cache = cacheOf([snapshot(65000)]);
    const service = new PricesService(db as never, cache);

    await expect(
      service.getLatestForAssets([asset], 'USD', freshFor),
    ).resolves.toEqual(
      new Map([
        [
          asset.id,
          {
            price: '65000',
            asOf,
            change24h: '-100',
            changePercent24h: '1.5',
            volume24h: '20',
            high24h: '66000',
            low24h: '64000',
          },
        ],
      ]),
    );
    expect(db.select).not.toHaveBeenCalled();
  });

  it('returns a stale redis price without calling a provider', async () => {
    const staleAsOf = new Date(Date.now() - freshFor - 1);
    const db = database([]);
    const service = new PricesService(db as never, cacheOf([snapshot(60000, staleAsOf)]));

    await expect(
      service.getLatestForAssets([asset], 'USD', freshFor),
    ).resolves.toEqual(
      new Map([[asset.id, expect.objectContaining({ price: '60000', asOf: staleAsOf })]]),
    );
    expect(db.select).not.toHaveBeenCalled();
  });

  it('falls back to the last postgres price when redis has none', async () => {
    const db = database([{ assetId: asset.id, price: '60000', asOf }]);
    const cache = cacheOf([]);
    const service = new PricesService(db as never, cache);

    await expect(
      service.getLatestForAssets([asset], 'USD', freshFor),
    ).resolves.toEqual(new Map([[asset.id, { price: '60000', asOf }]]));
    expect(cache.readMany).toHaveBeenCalledWith([asset.id]);
  });

  it('does not read USD redis quotes for another currency', async () => {
    const db = database([]);
    const cache = cacheOf([snapshot(65000)]);
    const service = new PricesService(db as never, cache);

    await expect(
      service.getLatestForAssets([asset], 'EUR', freshFor),
    ).resolves.toEqual(new Map());
    expect(cache.readMany).not.toHaveBeenCalled();
  });

  it('stores the ingested USD quote for the postgres fallback', async () => {
    const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
    const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
    const insert = jest.fn().mockReturnValue({ values });
    const service = new PricesService(
      { select: jest.fn(), insert } as never,
      cacheOf([]) ,
    );

    await service.remember(snapshot(65000));

    expect(values).toHaveBeenCalledWith([
      {
        assetId: asset.id,
        currency: 'USD',
        price: '65000',
        asOf,
      },
    ]);
  });
});
