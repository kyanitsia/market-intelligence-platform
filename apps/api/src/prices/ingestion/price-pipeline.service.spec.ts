import { Logger } from '@nestjs/common';

import type { Asset } from '../../database/schema';
import type { PriceSnapshot } from '../market-data/market-data';
import { PriceCache, type RedisLike } from './price-cache';
import { PricePipelineService } from './price-pipeline.service';
import { parsePriceSnapshot } from './price-message';

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

function snapshot(): PriceSnapshot {
  return {
    assetId: btc.id,
    symbol: btc.symbol,
    price: 100,
    currency: 'USD',
    change24h: null,
    changePercent24h: null,
    volume24h: null,
    high24h: null,
    low24h: null,
    source: 'coingecko',
    fetchedAt: '2026-10-29T12:00:00.000Z',
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

function assetDatabase(asset: Asset | null) {
  const query = {
    from: jest.fn(),
    where: jest.fn(),
    limit: jest.fn().mockResolvedValue(asset ? [asset] : []),
  };
  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);

  return { select: jest.fn().mockReturnValue(query) };
}

function setup(asset: Asset | null) {
  const redis = memoryRedis();
  const published: unknown[] = [];
  const consumed = new Map<string, (body: unknown) => Promise<void>>();
  const broker = {
    publish: jest.fn(async (_key: string, body: unknown) => {
      published.push(body);
    }),
    consume: jest.fn(
      (queue: string, handler: (body: unknown) => Promise<void>) => {
        consumed.set(queue, handler);
      },
    ),
  };
  const prices = { remember: jest.fn().mockResolvedValue(undefined) };
  const candles = {
    needsSync: jest.fn().mockReturnValue(true),
    sync: jest.fn().mockResolvedValue(undefined),
  };
  const alerts = {
    plan: jest.fn().mockResolvedValue([]),
    store: jest.fn().mockResolvedValue(undefined),
  };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const service = new PricePipelineService(
    broker as never,
    new PriceCache(redis),
    prices as never,
    candles as never,
    alerts as never,
    config as never,
    assetDatabase(asset) as never,
  );

  return { service, redis, broker, prices, candles, alerts, consumed };
}

describe('price pipeline', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers a consumer for prices, alerts, and notifications', () => {
    const { service, broker } = setup(btc);

    service.onModuleInit();

    expect(broker.consume).toHaveBeenCalledTimes(3);
    expect(broker.consume.mock.calls.map((call) => call[0])).toEqual([
      'price.updates',
      'price.updates.alerts',
      'notifications',
    ]);
  });

  it('writes the cache and candles for a known asset', async () => {
    const { service, redis, prices, candles } = setup(btc);

    await service.persist(snapshot());

    expect(redis.store.get('price:btc-id')?.ttl).toBe(900);
    expect(prices.remember).toHaveBeenCalledWith(snapshot());
    expect(candles.sync).toHaveBeenCalledWith(btc);
  });

  it('keeps the stored price when candle history is rejected', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, prices, candles } = setup(btc);
    candles.sync.mockRejectedValue(new Error('finnhub request failed (403)'));

    await expect(service.persist(snapshot())).resolves.toBeUndefined();

    expect(prices.remember).toHaveBeenCalledWith(snapshot());
    expect(warn).toHaveBeenCalledWith(
      'Candle sync failed for BTC: finnhub request failed (403)',
    );
  });

  it('drops a price update when the asset no longer exists', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { service, redis, prices } = setup(null);

    await service.persist(snapshot());

    expect(redis.store.size).toBe(0);
    expect(prices.remember).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      'Dropping price update for unknown asset btc-id',
    );
  });

  it('publishes one notification message per matched alert', async () => {
    const { service, alerts, broker } = setup(btc);
    const message = { dedupeKey: 'alert-1:2026-10-29T12:00:00.000Z' };
    alerts.plan.mockResolvedValue([message]);

    await service.fanoutAlerts(snapshot());

    expect(broker.publish).toHaveBeenCalledWith('notifications', message);
  });

  it('rejects a price payload that is not a snapshot', () => {
    expect(() => parsePriceSnapshot({ price: '100' })).toThrow(
      'Price update payload is invalid',
    );
  });
});
