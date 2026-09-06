import type { AuthenticatedUser } from '../../auth/auth.types';
import { HoldingsController } from './holdings.controller';
import type { HoldingsService } from './holdings.service';
import type { HoldingResponse } from './holdings.types';

describe('HoldingsController', () => {
  const currentUser: AuthenticatedUser = {
    id: 'user-id',
    email: 'test@example.com',
  };

  const holding: HoldingResponse = {
    id: 'holding-id',
    portfolioId: 'portfolio-id',
    quantity: '1.5',
    avgCostBasis: '42000',
    acquiredOn: '2024-03-01',
    asset: {
      id: 'asset-id',
      symbol: 'BTC',
      name: 'Bitcoin',
      assetType: 'CRYPTO',
      externalProvider: 'coingecko',
      externalId: 'bitcoin',
      status: 'ACTIVE',
    },
  };

  const dto = {
    asset: {
      symbol: 'BTC',
      externalId: 'bitcoin',
      assetType: 'CRYPTO' as const,
      name: 'Bitcoin',
    },
    quantity: '1.5',
    avgCostBasis: '42000',
    acquiredOn: '2024-03-01',
  };

  let holdingsService: {
    listForUser: jest.Mock;
    createForUser: jest.Mock;
  };
  let controller: HoldingsController;

  beforeEach(() => {
    holdingsService = {
      listForUser: jest.fn().mockResolvedValue([holding]),
      createForUser: jest.fn().mockResolvedValue(holding),
    };
    controller = new HoldingsController(
      holdingsService as unknown as HoldingsService,
    );
  });

  it('lists holdings for the current user', async () => {
    await expect(controller.list(currentUser, 'portfolio-id')).resolves.toEqual(
      [holding],
    );
    expect(holdingsService.listForUser).toHaveBeenCalledWith(
      'user-id',
      'portfolio-id',
    );
  });

  it('creates a holding', async () => {
    await expect(
      controller.create(currentUser, 'portfolio-id', dto),
    ).resolves.toEqual(holding);
    expect(holdingsService.createForUser).toHaveBeenCalledWith(
      'user-id',
      'portfolio-id',
      dto,
    );
  });
});
