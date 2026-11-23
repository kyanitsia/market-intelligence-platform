export type NotificationMessage = {
  userId: string;
  alertId: string;
  assetId: string;
  symbol: string;
  price: string;
  operator: 'GTE' | 'LTE';
  targetPrice: string;
  dedupeKey: string;
  triggeredAt: string;
};
