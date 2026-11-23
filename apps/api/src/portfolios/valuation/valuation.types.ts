export type Currency = 'USD' | 'EUR';

export type CachedPrice = {
  price: string;
  asOf: Date;
  change24h?: string | null;
  changePercent24h?: string | null;
  volume24h?: string | null;
  high24h?: string | null;
  low24h?: string | null;
};

export type QuoteStats = {
  change24h: string | null;
  changePercent24h: string | null;
  volume24h: string | null;
  high24h: string | null;
  low24h: string | null;
};

export function quoteStats(cached: CachedPrice | undefined): QuoteStats {
  return {
    change24h: cached?.change24h ?? null,
    changePercent24h: cached?.changePercent24h ?? null,
    volume24h: cached?.volume24h ?? null,
    high24h: cached?.high24h ?? null,
    low24h: cached?.low24h ?? null,
  };
}

export type HoldingValuation = QuoteStats & {
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
