import type { NotificationMessage } from '../alerts/notification-message';
import type { PriceSnapshot } from '../market-data/market-data';

export function parsePriceSnapshot(body: unknown): PriceSnapshot {
  if (!isRecord(body)) {
    throw new Error('Price update payload is invalid');
  }

  const source = body.source;
  const currency = body.currency;

  if (
    typeof body.assetId !== 'string' ||
    typeof body.symbol !== 'string' ||
    typeof body.price !== 'number' ||
    !Number.isFinite(body.price) ||
    typeof body.fetchedAt !== 'string' ||
    currency !== 'USD' ||
    (source !== 'coingecko' && source !== 'finnhub')
  ) {
    throw new Error('Price update payload is invalid');
  }

  return {
    assetId: body.assetId,
    symbol: body.symbol,
    price: body.price,
    currency: 'USD',
    change24h: numberOrNull(body.change24h),
    changePercent24h: numberOrNull(body.changePercent24h),
    volume24h: numberOrNull(body.volume24h),
    high24h: numberOrNull(body.high24h),
    low24h: numberOrNull(body.low24h),
    source,
    fetchedAt: body.fetchedAt,
  };
}

export function parseNotificationMessage(body: unknown): NotificationMessage {
  if (!isRecord(body)) {
    throw new Error('Notification payload is invalid');
  }

  const operator = body.operator;

  if (
    typeof body.userId !== 'string' ||
    typeof body.alertId !== 'string' ||
    typeof body.assetId !== 'string' ||
    typeof body.symbol !== 'string' ||
    typeof body.price !== 'string' ||
    typeof body.targetPrice !== 'string' ||
    typeof body.dedupeKey !== 'string' ||
    typeof body.triggeredAt !== 'string' ||
    (operator !== 'GTE' && operator !== 'LTE')
  ) {
    throw new Error('Notification payload is invalid');
  }

  return {
    userId: body.userId,
    alertId: body.alertId,
    assetId: body.assetId,
    symbol: body.symbol,
    price: body.price,
    operator,
    targetPrice: body.targetPrice,
    dedupeKey: body.dedupeKey,
    triggeredAt: body.triggeredAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
