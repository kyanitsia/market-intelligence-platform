import type { AuthenticatedUser } from '../auth/auth.types';
import { PortfoliosController } from './portfolios.controller';
import type { PortfoliosService } from './portfolios.service';
import type { PortfolioResponse } from './portfolios.types';

describe('PortfoliosController', () => {
  const currentUser: AuthenticatedUser = {
    id: 'user-id',
    email: 'test@example.com',
  };

  const portfolio: PortfolioResponse = {
    id: 'portfolio-id',
    name: 'Default',
    version: 1,
    visibility: 'PRIVATE',
    shareMode: 'HIDDEN',
    createdAt: new Date('2026-01-15T12:00:00.000Z'),
    updatedAt: new Date('2026-01-15T12:00:00.000Z'),
  };

  let portfoliosService: {
    listForUser: jest.Mock;
    findOneForUser: jest.Mock;
    createForUser: jest.Mock;
    updateForUser: jest.Mock;
    softDeleteForUser: jest.Mock;
  };
  let controller: PortfoliosController;

  beforeEach(() => {
    portfoliosService = {
      listForUser: jest.fn().mockResolvedValue([portfolio]),
      findOneForUser: jest.fn().mockResolvedValue(portfolio),
      createForUser: jest.fn().mockResolvedValue(portfolio),
      updateForUser: jest.fn().mockResolvedValue({
        ...portfolio,
        name: 'Growth',
      }),
      softDeleteForUser: jest.fn().mockResolvedValue(undefined),
    };
    controller = new PortfoliosController(
      portfoliosService as unknown as PortfoliosService,
    );
  });

  it('lists portfolios for the current user', async () => {
    await expect(controller.list(currentUser)).resolves.toEqual([portfolio]);
    expect(portfoliosService.listForUser).toHaveBeenCalledWith('user-id');
  });

  it('reads one portfolio', async () => {
    await expect(
      controller.findOne(currentUser, 'portfolio-id'),
    ).resolves.toEqual(portfolio);
    expect(portfoliosService.findOneForUser).toHaveBeenCalledWith(
      'user-id',
      'portfolio-id',
    );
  });

  it('creates a portfolio', async () => {
    await expect(
      controller.create(currentUser, { name: 'Default' }),
    ).resolves.toEqual(portfolio);
    expect(portfoliosService.createForUser).toHaveBeenCalledWith('user-id', {
      name: 'Default',
    });
  });

  it('updates a portfolio', async () => {
    await expect(
      controller.update(currentUser, 'portfolio-id', { name: 'Growth' }),
    ).resolves.toEqual({ ...portfolio, name: 'Growth' });
    expect(portfoliosService.updateForUser).toHaveBeenCalledWith(
      'user-id',
      'portfolio-id',
      { name: 'Growth' },
    );
  });

  it('soft-deletes a portfolio', async () => {
    await expect(
      controller.remove(currentUser, 'portfolio-id'),
    ).resolves.toBeUndefined();
    expect(portfoliosService.softDeleteForUser).toHaveBeenCalledWith(
      'user-id',
      'portfolio-id',
    );
  });
});
