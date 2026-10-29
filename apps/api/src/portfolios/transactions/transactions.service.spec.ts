import { BadRequestException, NotFoundException } from '@nestjs/common';

import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  const userId = 'user-id';
  const portfolioId = 'portfolio-id';
  const holdingId = 'holding-id';
  const now = new Date('2026-09-11T12:00:00.000Z');

  const asset = {
    id: 'asset-id',
    symbol: 'BTC',
    name: 'Bitcoin',
    assetType: 'CRYPTO' as const,
    externalProvider: 'coingecko',
    externalId: 'bitcoin',
    status: 'ACTIVE' as const,
  };

  const holding = {
    id: holdingId,
    portfolioId,
    assetId: asset.id,
    quantity: '15',
    avgCostBasis: '13.333333333333',
    acquiredOn: '2024-01-01',
  };

  const buyRows = [
    {
      type: 'BUY' as const,
      quantity: '10',
      price: '10',
      occurredAt: new Date('2024-01-01T00:00:00.000Z'),
    },
    {
      type: 'BUY' as const,
      quantity: '5',
      price: '20',
      occurredAt: new Date('2024-02-01T00:00:00.000Z'),
    },
  ];

  const sellTransaction = {
    id: 'sell-id',
    portfolioId,
    assetId: asset.id,
    type: 'SELL' as const,
    quantity: '12',
    price: '30',
    realizedPnl: '220',
    occurredAt: now,
    createdAt: now,
  };

  function createDatabase(options: {
    selectQueue?: unknown[][];
    insertQueue?: unknown[][];
    updateQueue?: unknown[][];
  }) {
    const selectQueue = [...(options.selectQueue ?? [])];
    const insertQueue = [...(options.insertQueue ?? [])];
    const updateQueue = [...(options.updateQueue ?? [])];

    const select = jest.fn(() => {
      const rows = selectQueue.shift() ?? [];
      const builder = {
        from: jest.fn(),
        innerJoin: jest.fn(),
        where: jest.fn(),
        limit: jest.fn(),
        orderBy: jest.fn(),
      };

      builder.from.mockReturnValue(builder);
      builder.innerJoin.mockReturnValue(builder);
      builder.where.mockReturnValue(builder);
      builder.limit.mockResolvedValue(rows);
      builder.orderBy.mockResolvedValue(rows);

      return builder;
    });

    const insert = jest.fn(() => {
      const rows = insertQueue.shift() ?? [];
      return {
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(rows),
        }),
      };
    });

    const update = jest.fn(() => {
      const rows = updateQueue.shift() ?? [];
      return {
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue(rows),
          }),
        }),
      };
    });

    const database = {
      select,
      insert,
      update,
      delete: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
      transaction: jest.fn(),
    };

    database.transaction.mockImplementation(
      async (callback: (executor: typeof database) => Promise<unknown>) =>
        callback(database),
    );

    return database;
  }

  function createValuation() {
    return {
      valueRows: jest.fn(async (_userId: string, rows: unknown[]) => rows),
    };
  }

  it('appends a SELL with FIFO realized PnL and recomputes remaining cost basis', async () => {
    const remaining = {
      ...holding,
      quantity: '3',
      avgCostBasis: '20',
      acquiredOn: '2024-02-01',
    };
    const database = createDatabase({
      selectQueue: [[{ id: portfolioId }], [{ holding, asset }], buyRows],
      insertQueue: [[sellTransaction]],
      updateQueue: [[remaining], [{ id: portfolioId }]],
    });
    const valuation = {
      valueRows: jest.fn(async () => [
        {
          ...remaining,
          asset,
          valuation: {
            currency: 'USD' as const,
            price: null,
            priceAsOf: null,
            stale: true,
            currentValue: null,
            costBasis: '60',
            unrealizedPnl: null,
            unrealizedPnlPct: null,
            allocationPct: null,
          },
        },
      ]),
    };
    const service = new TransactionsService(
      database as never,
      valuation as never,
    );

    const result = await service.sellForUser(userId, portfolioId, holdingId, {
      quantity: '12',
      price: '30',
      occurredAt: now.toISOString(),
    });

    expect(result.transaction.realizedPnl).toBe('220');
    expect(result.transaction.type).toBe('SELL');
    expect(result.holding).toMatchObject({
      quantity: '3',
      avgCostBasis: '20',
    });
    expect(database.delete).not.toHaveBeenCalled();
  });

  it('deletes the holding when the remaining FIFO quantity is zero', async () => {
    const database = createDatabase({
      selectQueue: [
        [{ id: portfolioId }],
        [{ holding: { ...holding, quantity: '10' }, asset }],
        [buyRows[0]],
      ],
      insertQueue: [
        [{ ...sellTransaction, quantity: '10', realizedPnl: '200' }],
      ],
      updateQueue: [[{ id: portfolioId }]],
    });
    const service = new TransactionsService(
      database as never,
      createValuation() as never,
    );

    const result = await service.sellForUser(userId, portfolioId, holdingId, {
      quantity: '10',
      price: '30',
    });

    expect(result.holding).toBeNull();
    expect(database.delete).toHaveBeenCalled();
  });

  it('rejects a sell larger than remaining lots', async () => {
    const database = createDatabase({
      selectQueue: [[{ id: portfolioId }], [{ holding, asset }], [buyRows[0]]],
    });
    const service = new TransactionsService(
      database as never,
      createValuation() as never,
    );

    await expect(
      service.sellForUser(userId, portfolioId, holdingId, {
        quantity: '11',
        price: '30',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the holding is missing', async () => {
    const database = createDatabase({
      selectQueue: [[{ id: portfolioId }], []],
    });
    const service = new TransactionsService(
      database as never,
      createValuation() as never,
    );

    await expect(
      service.sellForUser(userId, portfolioId, holdingId, {
        quantity: '1',
        price: '30',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
