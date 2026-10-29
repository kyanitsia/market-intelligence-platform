import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import type { CreateHoldingDto } from './dto/create-holding.dto';
import { POSTGRES_UNIQUE_VIOLATION } from './holdings.constants';
import { HoldingsService } from './holdings.service';
import type { HoldingResponse } from './holdings.types';

describe('HoldingsService', () => {
  const portfolioId = 'portfolio-id';
  const userId = 'user-id';

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
    id: 'holding-id',
    portfolioId,
    assetId: asset.id,
    quantity: '1.5',
    avgCostBasis: '42000',
    acquiredOn: '2024-03-01',
  };

  const holdingResponse: HoldingResponse = {
    id: holding.id,
    portfolioId,
    quantity: holding.quantity,
    avgCostBasis: holding.avgCostBasis,
    acquiredOn: holding.acquiredOn,
    asset: {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      assetType: asset.assetType,
      externalProvider: asset.externalProvider,
      externalId: asset.externalId,
      status: asset.status,
    },
    valuation: {
      currency: 'USD',
      price: null,
      priceAsOf: null,
      stale: true,
      currentValue: null,
      costBasis: '63000',
      unrealizedPnl: null,
      unrealizedPnlPct: null,
      allocationPct: null,
    },
  };

  const dto: CreateHoldingDto = {
    asset: {
      symbol: 'BTC',
      externalId: 'bitcoin',
      assetType: 'CRYPTO',
      name: 'Bitcoin',
    },
    quantity: '1.5',
    avgCostBasis: '42000',
    acquiredOn: '2024-03-01',
  };

  function createDatabase(options: {
    selectQueue?: unknown[][];
    insertQueue?: unknown[][];
    insertErrors?: unknown[];
  }) {
    const selectQueue = [...(options.selectQueue ?? [])];
    const insertQueue = [...(options.insertQueue ?? [])];
    const insertErrors = [...(options.insertErrors ?? [])];

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
      const error = insertErrors.shift();

      if (error) {
        return {
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockRejectedValue(error),
          }),
        };
      }

      const rows = insertQueue.shift() ?? [];

      return {
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(rows),
        }),
      };
    });

    const database = {
      select,
      insert,
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
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
      valueRows: jest.fn(
        async (
          _userId: string,
          rows: Array<{ holding: typeof holding; asset: typeof asset }>,
        ) =>
          rows.map((row) => ({
            id: row.holding.id,
            portfolioId: row.holding.portfolioId,
            quantity: row.holding.quantity,
            avgCostBasis: row.holding.avgCostBasis,
            acquiredOn: row.holding.acquiredOn,
            asset: {
              id: row.asset.id,
              symbol: row.asset.symbol,
              name: row.asset.name,
              assetType: row.asset.assetType,
              externalProvider: row.asset.externalProvider,
              externalId: row.asset.externalId,
              status: row.asset.status,
            },
            valuation: {
              currency: 'USD' as const,
              price: null,
              priceAsOf: null,
              stale: true,
              currentValue: null,
              costBasis: '63000',
              unrealizedPnl: null,
              unrealizedPnlPct: null,
              allocationPct: null,
            },
          })),
      ),
    };
  }

  it('lists holdings for a portfolio', async () => {
    const database = createDatabase({
      selectQueue: [[{ id: portfolioId }], [{ holding, asset }]],
    });
    const valuation = createValuation();
    const service = new HoldingsService(database as never, valuation as never);

    await expect(service.listForUser(userId, portfolioId)).resolves.toEqual([
      holdingResponse,
    ]);
  });

  it('throws when listing holdings for a missing portfolio', async () => {
    const database = createDatabase({
      selectQueue: [[]],
    });
    const service = new HoldingsService(
      database as never,
      createValuation() as never,
    );

    await expect(
      service.listForUser(userId, 'missing-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a holding and catalogs the asset by symbol and external id', async () => {
    const database = createDatabase({
      selectQueue: [
        [{ id: portfolioId }],
        [],
        [],
        [{ id: portfolioId }],
        [{ holding, asset }],
      ],
      insertQueue: [[asset], [holding]],
    });
    const values = jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([asset]),
    });
    const holdingValues = jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([holding]),
    });
    const buyValues = jest.fn().mockResolvedValue(undefined);
    database.insert
      .mockReturnValueOnce({ values })
      .mockReturnValueOnce({ values: holdingValues })
      .mockReturnValueOnce({ values: buyValues });

    const service = new HoldingsService(
      database as never,
      createValuation() as never,
    );

    await expect(
      service.createForUser(userId, portfolioId, dto),
    ).resolves.toEqual(holdingResponse);

    expect(values).toHaveBeenCalledWith({
      symbol: 'BTC',
      name: 'Bitcoin',
      assetType: 'CRYPTO',
      externalProvider: 'coingecko',
      externalId: 'bitcoin',
    });
    expect(holdingValues).toHaveBeenCalledWith({
      portfolioId,
      assetId: asset.id,
      quantity: '1.5',
      avgCostBasis: '42000',
      acquiredOn: '2024-03-01',
    });
    expect(buyValues).toHaveBeenCalledWith({
      portfolioId,
      assetId: asset.id,
      type: 'BUY',
      quantity: '1.5',
      price: '42000',
      occurredAt: new Date('2024-03-01T00:00:00.000Z'),
    });
  });

  it('reuses an existing catalog asset', async () => {
    const database = createDatabase({
      selectQueue: [
        [{ id: portfolioId }],
        [asset],
        [asset],
        [{ id: portfolioId }],
        [{ holding, asset }],
      ],
      insertQueue: [[holding]],
    });
    const service = new HoldingsService(
      database as never,
      createValuation() as never,
    );

    await expect(
      service.createForUser(userId, portfolioId, dto),
    ).resolves.toEqual(holdingResponse);

    expect(database.insert).toHaveBeenCalledTimes(2);
  });

  it('rejects quantity that is not greater than 0', async () => {
    const database = createDatabase({});
    const service = new HoldingsService(
      database as never,
      createValuation() as never,
    );

    await expect(
      service.createForUser(userId, portfolioId, {
        ...dto,
        quantity: '0',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a negative cost basis', async () => {
    const database = createDatabase({});
    const service = new HoldingsService(
      database as never,
      createValuation() as never,
    );

    await expect(
      service.createForUser(userId, portfolioId, {
        ...dto,
        avgCostBasis: '-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a zero cost basis', async () => {
    const zeroCostHolding = { ...holding, avgCostBasis: '0' };
    const database = createDatabase({
      selectQueue: [
        [{ id: portfolioId }],
        [asset],
        [asset],
        [{ id: portfolioId }],
        [{ holding: zeroCostHolding, asset }],
      ],
      insertQueue: [[zeroCostHolding]],
    });
    const service = new HoldingsService(
      database as never,
      createValuation() as never,
    );

    await expect(
      service.createForUser(userId, portfolioId, {
        ...dto,
        avgCostBasis: '0',
      }),
    ).resolves.toEqual({
      ...holdingResponse,
      avgCostBasis: '0',
    });
  });

  it('throws when the portfolio is missing', async () => {
    const database = createDatabase({
      selectQueue: [[]],
    });
    const service = new HoldingsService(
      database as never,
      createValuation() as never,
    );

    await expect(
      service.createForUser(userId, 'missing-id', dto),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when the asset identity does not match a catalog entry', async () => {
    const database = createDatabase({
      selectQueue: [
        [{ id: portfolioId }],
        [{ ...asset, symbol: 'ETH' }],
        [asset],
      ],
    });
    const service = new HoldingsService(
      database as never,
      createValuation() as never,
    );

    await expect(
      service.createForUser(userId, portfolioId, dto),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('defaults STOCK assets to the finnhub provider', async () => {
    const stockAsset = {
      ...asset,
      id: 'stock-asset-id',
      symbol: 'AAPL',
      name: 'Apple',
      assetType: 'STOCK' as const,
      externalProvider: 'finnhub',
      externalId: 'AAPL',
    };
    const stockHolding = {
      ...holding,
      assetId: stockAsset.id,
    };
    const values = jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([stockAsset]),
    });
    const holdingValues = jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([stockHolding]),
    });
    const buyValues = jest.fn().mockResolvedValue(undefined);
    const database = createDatabase({
      selectQueue: [
        [{ id: portfolioId }],
        [],
        [],
        [{ id: portfolioId }],
        [{ holding: stockHolding, asset: stockAsset }],
      ],
    });
    database.insert
      .mockReturnValueOnce({ values })
      .mockReturnValueOnce({ values: holdingValues })
      .mockReturnValueOnce({ values: buyValues });

    const service = new HoldingsService(
      database as never,
      createValuation() as never,
    );

    await service.createForUser(userId, portfolioId, {
      ...dto,
      asset: {
        symbol: 'AAPL',
        externalId: 'AAPL',
        assetType: 'STOCK',
        name: 'Apple',
      },
    });

    expect(values).toHaveBeenCalledWith({
      symbol: 'AAPL',
      name: 'Apple',
      assetType: 'STOCK',
      externalProvider: 'finnhub',
      externalId: 'AAPL',
    });
  });

  it('throws when the asset is already in the portfolio', async () => {
    const database = createDatabase({
      selectQueue: [[{ id: portfolioId }], [asset], [asset]],
      insertErrors: [
        { message: 'Failed query', cause: { code: POSTGRES_UNIQUE_VIOLATION } },
      ],
    });
    const service = new HoldingsService(
      database as never,
      createValuation() as never,
    );

    await expect(
      service.createForUser(userId, portfolioId, dto),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
