import { NotFoundException } from '@nestjs/common';

import {
  DEFAULT_PORTFOLIO_NAME,
  PortfoliosService,
} from './portfolios.service';
import type { PortfolioResponse } from './portfolios.types';

describe('PortfoliosService', () => {
  const portfolio: PortfolioResponse = {
    id: 'portfolio-id',
    name: 'Default',
    version: 1,
    visibility: 'PRIVATE',
    shareMode: 'HIDDEN',
    createdAt: new Date('2026-01-15T12:00:00.000Z'),
    updatedAt: new Date('2026-01-15T12:00:00.000Z'),
  };

  function createDatabase(options: {
    selectRows?: PortfolioResponse[];
    insertRows?: PortfolioResponse[];
    updateRows?: PortfolioResponse[] | Array<{ id: string }>;
  }) {
    return {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest
              .fn()
              .mockResolvedValue(options.selectRows ?? [portfolio]),
            limit: jest
              .fn()
              .mockResolvedValue(options.selectRows ?? [portfolio]),
          }),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest
            .fn()
            .mockResolvedValue(options.insertRows ?? [portfolio]),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest
              .fn()
              .mockResolvedValue(options.updateRows ?? [portfolio]),
          }),
        }),
      }),
    };
  }

  it('lists active portfolios for a user', async () => {
    const database = createDatabase({ selectRows: [portfolio] });
    const service = new PortfoliosService(database as never);

    await expect(service.listForUser('user-id')).resolves.toEqual([portfolio]);
  });

  it('throws when a portfolio is missing', async () => {
    const database = createDatabase({ selectRows: [] });
    const service = new PortfoliosService(database as never);

    await expect(
      service.findOneForUser('user-id', 'missing-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a named portfolio', async () => {
    const database = createDatabase({});
    const service = new PortfoliosService(database as never);
    const values = jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([portfolio]),
    });
    database.insert.mockReturnValue({ values });

    await expect(
      service.createForUser('user-id', { name: '  Growth  ' }),
    ).resolves.toEqual(portfolio);

    expect(values).toHaveBeenCalledWith({
      userId: 'user-id',
      name: 'Growth',
    });
  });

  it('updates a portfolio name', async () => {
    const updated = { ...portfolio, name: 'Growth' };
    const database = createDatabase({
      selectRows: [portfolio],
      updateRows: [updated],
    });
    const service = new PortfoliosService(database as never);

    await expect(
      service.updateForUser('user-id', 'portfolio-id', { name: 'Growth' }),
    ).resolves.toEqual(updated);
  });

  it('soft-deletes a portfolio', async () => {
    const database = createDatabase({
      selectRows: [portfolio],
      updateRows: [{ id: 'portfolio-id' }],
    });
    const set = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 'portfolio-id' }]),
      }),
    });
    database.update.mockReturnValue({ set });

    const service = new PortfoliosService(database as never);
    await expect(
      service.softDeleteForUser('user-id', 'portfolio-id'),
    ).resolves.toBeUndefined();

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        deletedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
  });

  it('creates the default portfolio for a new user', async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn().mockReturnValue({ values });
    const service = new PortfoliosService({ insert } as never);

    await service.createDefaultForUser('user-id');

    expect(values).toHaveBeenCalledWith({
      userId: 'user-id',
      name: DEFAULT_PORTFOLIO_NAME,
    });
  });
});
