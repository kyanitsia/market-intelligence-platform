export type TransactionType = 'BUY' | 'SELL';

export type TransactionResponse = {
  id: string;
  portfolioId: string;
  assetId: string;
  type: TransactionType;
  quantity: string;
  price: string;
  realizedPnl: string | null;
  occurredAt: Date;
  createdAt: Date;
};

export type SellResponse = {
  transaction: TransactionResponse;
  holding: import('../holdings/holdings.types').HoldingResponse | null;
};
