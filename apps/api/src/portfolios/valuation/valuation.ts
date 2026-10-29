import {
  addDecimal,
  isZeroDecimalString,
  mulDecimal,
  percentOf,
  subDecimal,
} from '../../common/decimal-math';
import type {
  HoldingAssetResponse,
  HoldingResponse,
} from '../holdings/holdings.types';
import type {
  CachedPrice,
  Currency,
  HoldingValuation,
  PortfolioValuation,
} from './valuation.types';

export type ValuationHoldingRow = {
  holding: {
    id: string;
    portfolioId: string;
    quantity: string;
    avgCostBasis: string;
    acquiredOn: string;
  };
  asset: HoldingAssetResponse;
};

export type ValueHoldingsOptions = {
  currency: Currency;
  now: Date;
  staleAfterMs: number;
};

export type ValuedPortfolio = {
  holdings: HoldingResponse[];
  portfolio: PortfolioValuation;
};

export function valueHoldings(
  rows: ValuationHoldingRow[],
  prices: ReadonlyMap<string, CachedPrice>,
  options: ValueHoldingsOptions,
): ValuedPortfolio {
  if (rows.length === 0) {
    return {
      holdings: [],
      portfolio: emptyPortfolioValuation(options.currency),
    };
  }
  const valued = rows.map((row) =>
    valueHolding(row, prices.get(row.asset.id), options),
  );
  const priced = valued.filter((item) => item.valuation.currentValue !== null);
  const portfolioCurrentValue = priced.reduce(
    (sum, item) => addDecimal(sum, item.valuation.currentValue ?? '0'),
    '0',
  );
  const portfolioCostBasis = valued.reduce(
    (sum, item) => addDecimal(sum, item.valuation.costBasis),
    '0',
  );
  const pricedCostBasis = priced.reduce(
    (sum, item) => addDecimal(sum, item.valuation.costBasis),
    '0',
  );
  const portfolioPnl = priced.length
    ? priced.reduce(
        (sum, item) => addDecimal(sum, item.valuation.unrealizedPnl ?? '0'),
        '0',
      )
    : null;

  assignAllocations(priced, portfolioCurrentValue);

  return {
    holdings: valued,
    portfolio: {
      currency: options.currency,
      currentValue: portfolioCurrentValue,
      costBasis: portfolioCostBasis,
      unrealizedPnl: portfolioPnl,
      unrealizedPnlPct:
        portfolioPnl === null ? null : percentOf(portfolioPnl, pricedCostBasis),
      allocationPct: null,
      stale: valued.some((item) => item.valuation.stale),
    },
  };
}

export function emptyPortfolioValuation(
  currency: Currency,
): PortfolioValuation {
  return {
    currency,
    currentValue: '0',
    costBasis: '0',
    unrealizedPnl: '0',
    unrealizedPnlPct: null,
    allocationPct: null,
    stale: false,
  };
}

function valueHolding(
  row: ValuationHoldingRow,
  cached: CachedPrice | undefined,
  options: ValueHoldingsOptions,
): HoldingResponse {
  const costBasis = mulDecimal(row.holding.quantity, row.holding.avgCostBasis);
  const stale = isPriceStale(cached, options);
  const currentValue = cached
    ? mulDecimal(row.holding.quantity, cached.price)
    : null;
  const unrealizedPnl =
    currentValue === null ? null : subDecimal(currentValue, costBasis);

  const valuation: HoldingValuation = {
    currency: options.currency,
    price: cached?.price ?? null,
    priceAsOf: cached ? cached.asOf.toISOString() : null,
    stale,
    currentValue,
    costBasis,
    unrealizedPnl,
    unrealizedPnlPct:
      unrealizedPnl === null ? null : percentOf(unrealizedPnl, costBasis),
    allocationPct: null,
  };

  return {
    id: row.holding.id,
    portfolioId: row.holding.portfolioId,
    quantity: row.holding.quantity,
    avgCostBasis: row.holding.avgCostBasis,
    acquiredOn: row.holding.acquiredOn,
    asset: row.asset,
    valuation,
  };
}

function assignAllocations(
  priced: HoldingResponse[],
  portfolioCurrentValue: string,
): void {
  if (priced.length === 0) {
    return;
  }

  if (isZeroDecimalString(portfolioCurrentValue)) {
    for (const item of priced) {
      item.valuation.allocationPct = '0';
    }
    return;
  }

  let remaining = '100';

  for (const [index, item] of priced.entries()) {
    if (index === priced.length - 1) {
      item.valuation.allocationPct = remaining;
      return;
    }

    const allocation = percentOf(
      item.valuation.currentValue ?? '0',
      portfolioCurrentValue,
    );

    item.valuation.allocationPct = allocation ?? '0';
    remaining = subDecimal(remaining, item.valuation.allocationPct);
  }
}

function isPriceStale(
  cached: CachedPrice | undefined,
  options: ValueHoldingsOptions,
): boolean {
  if (!cached) {
    return true;
  }

  return options.now.getTime() - cached.asOf.getTime() > options.staleAfterMs;
}
