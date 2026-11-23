import type { PriceAlert } from '../../database/schema';
import type { PriceSnapshot } from '../market-data/market-data';
import { AlertEvaluationService } from './alert-evaluation.service';

const snapshot: PriceSnapshot = {
  assetId: 'btc-id',
  symbol: 'BTC',
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

const alert: PriceAlert = {
  id: 'alert-1',
  userId: 'user-1',
  assetId: 'btc-id',
  operator: 'GTE',
  targetPrice: '90.000000000000',
  active: true,
  lastTriggeredAt: null,
  cooldownMinutes: 60,
  createdAt: new Date('2026-10-29T10:00:00.000Z'),
};

function planDatabase(rows: PriceAlert[]) {
  const query = {
    from: jest.fn(),
    where: jest.fn().mockResolvedValue(rows),
  };
  query.from.mockReturnValue(query);

  return { select: jest.fn().mockReturnValue(query) };
}

describe('alert evaluation', () => {
  it('plans a notification when the threshold is met and the alert is idle', async () => {
    const service = new AlertEvaluationService(planDatabase([alert]) as never);

    await expect(service.plan(snapshot)).resolves.toEqual([
      {
        userId: 'user-1',
        alertId: 'alert-1',
        assetId: 'btc-id',
        symbol: 'BTC',
        price: '100',
        operator: 'GTE',
        targetPrice: '90.000000000000',
        dedupeKey: 'alert-1:2026-10-29T12:00:00.000Z',
        triggeredAt: '2026-10-29T12:00:00.000Z',
      },
    ]);
  });

  it('skips an alert that is still cooling down', async () => {
    const service = new AlertEvaluationService(
      planDatabase([
        {
          ...alert,
          lastTriggeredAt: new Date('2026-10-29T11:30:00.000Z'),
        },
      ]) as never,
    );

    await expect(service.plan(snapshot)).resolves.toEqual([]);
  });

  it('does not insert a second notification for the same dedupe key', async () => {
    const existing = { id: 'note-1' };
    const alertQuery = {
      from: jest.fn(),
      where: jest.fn(),
      limit: jest.fn().mockResolvedValue([alert]),
    };
    alertQuery.from.mockReturnValue(alertQuery);
    alertQuery.where.mockReturnValue(alertQuery);
    const noteQuery = {
      from: jest.fn(),
      where: jest.fn(),
      limit: jest.fn().mockResolvedValue([existing]),
    };
    noteQuery.from.mockReturnValue(noteQuery);
    noteQuery.where.mockReturnValue(noteQuery);
    const database = {
      select: jest
        .fn()
        .mockReturnValueOnce(alertQuery)
        .mockReturnValueOnce(noteQuery),
      transaction: jest.fn(),
    };
    const service = new AlertEvaluationService(database as never);

    await service.store({
      userId: alert.userId,
      alertId: alert.id,
      assetId: alert.assetId,
      symbol: 'BTC',
      price: '100',
      operator: 'GTE',
      targetPrice: alert.targetPrice,
      dedupeKey: 'alert-1:2026-10-29T12:00:00.000Z',
      triggeredAt: snapshot.fetchedAt,
    });

    expect(database.transaction).not.toHaveBeenCalled();
  });
});
