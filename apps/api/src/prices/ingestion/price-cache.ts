import { Inject, Injectable, Logger } from '@nestjs/common';

import type { PriceSnapshot } from '../market-data/market-data';
import { isPriceStale, priceKey } from './price-policy';

export const REDIS = Symbol('REDIS');

export type RedisLike = {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    expiryMode: 'EX',
    ttlSeconds: number,
  ): Promise<unknown>;
};

export type CachedPrice = PriceSnapshot & { stale: boolean };

@Injectable()
export class PriceCache {
  private readonly logger = new Logger(PriceCache.name);

  constructor(@Inject(REDIS) private readonly redis: RedisLike) {}

  async write(snapshot: PriceSnapshot, ttlSeconds: number): Promise<void> {
    await this.redis.set(
      priceKey(snapshot.assetId),
      JSON.stringify(snapshot),
      'EX',
      ttlSeconds,
    );
  }

  async readMany(
    assetIds: string[],
    now = Date.now(),
  ): Promise<Map<string, CachedPrice>> {
    const found = new Map<string, CachedPrice>();
    const rows = await Promise.all(
      assetIds.map(
        async (assetId) => [assetId, await this.read(assetId, now)] as const,
      ),
    );

    for (const [assetId, cached] of rows) {
      if (cached) {
        found.set(assetId, cached);
      }
    }

    return found;
  }

  async read(assetId: string, now = Date.now()): Promise<CachedPrice | null> {
    let raw: string | null;

    try {
      raw = await this.redis.get(priceKey(assetId));
    } catch (error: unknown) {
      this.logger.warn(this.failureMessage('read', error));
      return null;
    }

    if (!raw) {
      return null;
    }

    try {
      const snapshot = JSON.parse(raw) as PriceSnapshot;

      return {
        ...snapshot,
        stale: isPriceStale(snapshot.fetchedAt, now),
      };
    } catch {
      this.logger.warn(`Ignoring unreadable cached price for ${assetId}`);
      return null;
    }
  }

  private failureMessage(action: string, error: unknown): string {
    const message = error instanceof Error ? error.message : 'request failed';
    return `Redis price ${action} failed: ${message}`;
  }
}
