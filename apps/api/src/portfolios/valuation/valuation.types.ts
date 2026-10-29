export type Currency = 'USD' | 'EUR';

export type CachedPrice = {
  price: string;
  asOf: Date;
};

export type HoldingValuation = {
  currency: Currency;
  price: string | null;
  priceAsOf: string | null;
  stale: boolean;
  currentValue: string | null;
  costBasis: string;
  unrealizedPnl: string | null;
  unrealizedPnlPct: string | null;
  allocationPct: string | null;
};

export type PortfolioValuation = {
  currency: Currency;
  currentValue: string;
  costBasis: string;
  unrealizedPnl: string | null;
  unrealizedPnlPct: string | null;
  /** Share of the user's priced portfolio value. Null until assigned across portfolios. */
  allocationPct: string | null;
  stale: boolean;
};

export const DEFAULT_PRICE_STALE_AFTER_MS = 15 * 60 * 1000;
