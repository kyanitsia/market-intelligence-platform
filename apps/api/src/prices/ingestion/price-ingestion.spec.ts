import { Logger } from '@nestjs/common';

import type { Asset } from '../../database/schema';
import type { PriceSnapshot } from '../market-data/market-data';
import { PriceCache, type RedisLike } from './price-cache';
import { PriceIngestionService } from './price-ingestion.service';
import {
  cacheTtlSeconds,
  DEFAULT_POLL_INTERVAL_MS,
  isPriceStale,
  PRICE_STALE_AFTER_MS,
} from './price-policy';

const btc: Asset = {
  id: 'btc-id',
  symbol: 'BTC',
  name: 'Bitcoin',
  assetType: 'CRYPTO',
  externalProvider: 'coingecko',
  externalId: 'bitcoin',
  status: 'ACTIVE',
  candlesSyncedAt: new Date('2026-11-20T12:00:00.000Z'),
};

const aapl: Asset = {
  id: 'aapl-id',
  symbol: 'AAPL',
  name: 'Apple',
  assetType: 'STOCK',
  externalProvider: 'finnhub',
  externalId: 'AAPL',
  status: 'ACTIVE',
  candlesSyncedAt: new Date('2026-11-20T12:00:00.000Z'),
};

function snapshot(asset: Asset, fetchedAt: string): PriceSnapshot {
  return {
    assetId: asset.id,
    symbol: asset.symbol,
    price: asset.assetType === 'CRYPTO' ? 100 : 20,
    currency: 'USD',
    change24h: null,
    changePercent24h: null,
    volume24h: null,
    high24h: null,
    low24h: null,
    source: asset.assetType === 'CRYPTO' ? 'coingecko' : 'finnhub',
    fetchedAt,
  };
}

function memoryRedis(): RedisLike & {
  store: Map<string, { value: string; ttl: number }>;
} {
  const store = new Map<string, { value: string; ttl: number }>();

  return {
    store,
    get: jest.fn(async (key: string) => store.get(key)?.value ?? null),
    set: jest.fn(
      async (key: string, value: string, _mode: 'EX', ttl: number) => {
        store.set(key, { value, ttl });
        return 'OK';
      },
    ),
  };
}

function database(rows: Array<{ asset: Asset }>) {
  const query: {
    from: jest.Mock;
    innerJoin: jest.Mock;
    where: jest.Mock;
  } = {
    from: jest.fn(),
    innerJoin: jest.fn(),
    where: jest.fn().mockResolvedValue(rows),
  };
  query.from.mockReturnValue(query);
  query.innerJoin.mockReturnValue(query);

  return { select: jest.fn().mockReturnValue(query) };
}

function setup(options?: {
  interval?: string;
  rows?: Array<{ asset: Asset }>;
}) {
  const redis = memoryRedis();
  const cache = new PriceCache(redis);
  const marketData = { getLatestPrice: jest.fn() };
  const broker = { publish: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue(options?.interval) };
  const scheduler = {
    addInterval: jest.fn(),
    deleteInterval: jest.fn(),
    doesExist: jest.fn().mockReturnValue(true),
  };
  const service = new PriceIngestionService(
    database(
      options?.rows ?? [{ asset: btc }, { asset: btc }, { asset: aapl }],
    ) as never,
    marketData as never,
    broker as never,
    config as never,
    scheduler as never,
  );

  jest.spyOn(service, 'delay').mockResolvedValue(undefined);

  return { service, redis, cache, marketData, broker, scheduler };
}

describe('price ingestion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers a poll on the configured interval', () => {
    const callbacks: Array<() => void> = [];
    jest.spyOn(global, 'setInterval').mockImplementation(((
      callback: () => void,
    ) => {
      callbacks.push(callback);
      return 1 as unknown as NodeJS.Timeout;
    }) as typeof setInterval);
    const { service, scheduler } = setup();
    const poll = jest.spyOn(service, 'poll').mockResolvedValue(undefined);

    service.onModuleInit();

    expect(setInterval).toHaveBeenCalledWith(
      expect.any(Function),
      DEFAULT_POLL_INTERVAL_MS,
    );
    expect(scheduler.addInterval).toHaveBeenCalledWith('market-data-poll', 1);
    expect(poll).toHaveBeenCalledTimes(1);
    callbacks[0]();
    expect(poll).toHaveBeenCalledTimes(2);

    service.onModuleDestroy();
    expect(scheduler.deleteInterval).toHaveBeenCalledWith('market-data-poll');
  });

  it('uses MARKET_DATA_POLL_INTERVAL_MS when it is set', () => {
    jest
      .spyOn(global, 'setInterval')
      .mockImplementation((() => 1) as unknown as typeof setInterval);
    const { service } = setup({ interval: '1200000' });
    jest.spyOn(service, 'poll').mockResolvedValue(undefined);

    service.onModuleInit();

    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1_200_000);
    expect(service.intervalMs()).toBe(1_200_000);
  });

  it('dedupes held assets and publishes one price update per asset', async () => {
    const { service, marketData, broker } = setup();
    marketData.getLatestPrice.mockImplementation(async (asset: Asset) =>
      snapshot(asset, '2026-10-29T12:00:00.000Z'),
    );

    await expect(service.loadRelevantAssets()).resolves.toEqual([btc, aapl]);
    await service.poll();

    expect(marketData.getLatestPrice).toHaveBeenCalledTimes(2);
    expect(marketData.getLatestPrice).toHaveBeenNthCalledWith(1, btc);
    expect(marketData.getLatestPrice).toHaveBeenNthCalledWith(2, aapl);
    expect(broker.publish).toHaveBeenCalledTimes(2);
    expect(broker.publish).toHaveBeenNthCalledWith(
      1,
      'price.updates',
      snapshot(btc, '2026-10-29T12:00:00.000Z'),
    );
    expect(broker.publish).toHaveBeenNthCalledWith(
      2,
      'price.updates',
      snapshot(aapl, '2026-10-29T12:00:00.000Z'),
    );
  });

  it('derives a longer TTL when the poll interval exceeds 900 seconds', () => {
    expect(cacheTtlSeconds(DEFAULT_POLL_INTERVAL_MS)).toBe(900);
    expect(cacheTtlSeconds(20 * 60 * 1000)).toBe(1200);
  });

  it('reads a cached price without calling a provider and marks it stale from fetchedAt', async () => {
    const redis = memoryRedis();
    const cache = new PriceCache(redis);
    const now = Date.parse('2026-10-29T12:00:00.000Z');

    await cache.write(snapshot(btc, new Date(now).toISOString()), 900);
    await cache.write(
      snapshot(aapl, new Date(now - PRICE_STALE_AFTER_MS - 1).toISOString()),
      900,
    );

    const fresh = await cache.read(btc.id, now);
    const stale = await cache.read(aapl.id, now);

    expect(fresh).toMatchObject({ assetId: btc.id, stale: false, price: 100 });
    expect(stale).toMatchObject({ assetId: aapl.id, stale: true });
    expect(
      isPriceStale(new Date(now - PRICE_STALE_AFTER_MS).toISOString(), now),
    ).toBe(false);
    expect(await cache.read('missing', now)).toBeNull();
  });

  it('keeps going when one asset fails and leaves the previous price in place', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { service, marketData, broker, redis, cache } = setup({
      rows: [{ asset: btc }, { asset: aapl }],
    });
    const previous = snapshot(btc, '2026-10-29T11:50:00.000Z');
    await cache.write(previous, 900);
    marketData.getLatestPrice
      .mockRejectedValueOnce(new Error('coingecko request failed (429)'))
      .mockResolvedValueOnce(snapshot(aapl, '2026-10-29T12:00:00.000Z'));

    await service.poll();

    expect(
      JSON.parse(redis.store.get('price:btc-id')?.value ?? ''),
    ).toMatchObject(previous);
    expect(broker.publish).toHaveBeenCalledTimes(1);
    expect(broker.publish).toHaveBeenCalledWith(
      'price.updates',
      snapshot(aapl, '2026-10-29T12:00:00.000Z'),
    );
    expect(warn).toHaveBeenCalledWith(
      'Price ingest failed for BTC: coingecko request failed (429)',
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain('token=');
  });

  it('spaces calls to the same provider', async () => {
    const eth: Asset = {
      ...btc,
      id: 'eth-id',
      symbol: 'ETH',
      externalId: 'ethereum',
    };
    const { service, marketData } = setup({
      rows: [{ asset: btc }, { asset: eth }],
    });
    marketData.getLatestPrice.mockImplementation(async (asset: Asset) =>
      snapshot(asset, '2026-10-29T12:00:00.000Z'),
    );

    await service.poll();

    expect(service.delay).toHaveBeenCalledTimes(1);
    expect((service.delay as jest.Mock).mock.calls[0][0]).toBeGreaterThan(
      11_000,
    );
  });

  it('does not start a second poll while one is running', async () => {
    const { service, marketData } = setup({ rows: [{ asset: btc }] });
    let release: () => void = () => undefined;
    let started: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    marketData.getLatestPrice.mockImplementation(() => {
      started();
      return gate.then(() => snapshot(btc, '2026-10-29T12:00:00.000Z'));
    });

    const first = service.poll();
    await startedPromise;
    await service.poll();

    expect(marketData.getLatestPrice).toHaveBeenCalledTimes(1);
    release();
    await first;
    expect(marketData.getLatestPrice).toHaveBeenCalledTimes(1);
  });
});
