import type { AuthenticatedUser } from '../../auth/auth.types';
import { TransactionsController } from './transactions.controller';
import type { TransactionsService } from './transactions.service';
import type { SellResponse, TransactionResponse } from './transactions.types';

describe('TransactionsController', () => {
  const currentUser: AuthenticatedUser = {
    id: 'user-id',
    email: 'test@example.com',
  };

  const transaction: TransactionResponse = {
    id: 'sell-id',
    portfolioId: 'portfolio-id',
    assetId: 'asset-id',
    type: 'SELL',
    quantity: '12',
    price: '30',
    realizedPnl: '220',
    occurredAt: new Date('2026-09-11T12:00:00.000Z'),
    createdAt: new Date('2026-09-11T12:00:00.000Z'),
  };

  const sellResponse: SellResponse = {
    transaction,
    holding: null,
  };

  let transactionsService: {
    listForUser: jest.Mock;
    sellForUser: jest.Mock;
  };
  let controller: TransactionsController;

  beforeEach(() => {
    transactionsService = {
      listForUser: jest.fn().mockResolvedValue([transaction]),
      sellForUser: jest.fn().mockResolvedValue(sellResponse),
    };
    controller = new TransactionsController(
      transactionsService as unknown as TransactionsService,
    );
  });

  it('lists transactions for the current user', async () => {
    await expect(controller.list(currentUser, 'portfolio-id')).resolves.toEqual(
      [transaction],
    );
    expect(transactionsService.listForUser).toHaveBeenCalledWith(
      'user-id',
      'portfolio-id',
    );
  });

  it('records a sell', async () => {
    const dto = { quantity: '12', price: '30' };

    await expect(
      controller.sell(currentUser, 'portfolio-id', 'holding-id', dto),
    ).resolves.toEqual(sellResponse);
    expect(transactionsService.sellForUser).toHaveBeenCalledWith(
      'user-id',
      'portfolio-id',
      'holding-id',
      dto,
    );
  });
});
