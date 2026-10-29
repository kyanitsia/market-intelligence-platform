import type { CachedPrice } from './valuation.types';
import {
  assignPortfolioAllocations,
  valueHoldings,
  type ValuationHoldingRow,
} from './value-holdings';
import type { PortfolioValuation } from './valuation.types';

const now = new Date('2026-09-11T12:00:00.000Z');
const staleAfterMs = 15 * 60 * 1000;

const btcAsset = {
  id: 'btc',
  symbol: 'BTC',
  name: 'Bitcoin',
  assetType: 'CRYPTO' as const,
  externalProvider: 'coingecko',
  externalId: 'bitcoin',
  status: 'ACTIVE' as const,
};

const ethAsset = {
  id: 'eth',
  symbol: 'ETH',
  name: 'Ether',
  assetType: 'CRYPTO' as const,
  externalProvider: 'coingecko',
  externalId: 'ethereum',
  status: 'ACTIVE' as const,
};

function holding(
  id: string,
  asset: typeof btcAsset,
  quantity: string,
  avgCostBasis: string,
): ValuationHoldingRow {
  return {
    holding: {
      id,
      portfolioId: 'portfolio-id',
      quantity,
      avgCostBasis,
      acquiredOn: '2024-03-01',
    },
    asset,
  };
}

describe('Appendix A valuation', () => {
  it('returns a zeroed portfolio valuation when there are no holdings', () => {
    expect(
      valueHoldings([], new Map(), { currency: 'EUR', now, staleAfterMs }),
    ).toEqual({
      holdings: [],
      portfolio: {
        currency: 'EUR',
        currentValue: '0',
        costBasis: '0',
        unrealizedPnl: '0',
        unrealizedPnlPct: null,
        allocationPct: null,
        stale: false,
      },
    });
  });

  it('computes current value, unrealized PnL, and allocation from avg_cost_basis', () => {
    const prices = new Map<string, CachedPrice>([
      ['btc', { price: '15', asOf: now }],
      ['eth', { price: '80', asOf: now }],
    ]);

    const valued = valueHoldings(
      [holding('a', btcAsset, '2', '10'), holding('b', ethAsset, '1', '100')],
      prices,
      { currency: 'USD', now, staleAfterMs },
    );

    expect(valued.holdings[0].valuation).toMatchObject({
      price: '15',
      stale: false,
      currentValue: '30',
      costBasis: '20',
      unrealizedPnl: '10',
      unrealizedPnlPct: '50',
    });
    expect(valued.holdings[1].valuation).toMatchObject({
      currentValue: '80',
      costBasis: '100',
      unrealizedPnl: '-20',
      unrealizedPnlPct: '-20',
    });
    expect(valued.holdings[0].valuation.allocationPct).toBe('27.27272727');
    expect(valued.holdings[1].valuation.allocationPct).toBe('72.72727273');
    expect(valued.portfolio).toMatchObject({
      currentValue: '110',
      costBasis: '120',
      unrealizedPnl: '-10',
      stale: false,
    });
  });

  it('marks a holding stale when the cached price is older than the threshold', () => {
    const asOf = new Date(now.getTime() - staleAfterMs - 1);
    const prices = new Map<string, CachedPrice>([
      ['btc', { price: '15', asOf }],
    ]);

    const valued = valueHoldings([holding('a', btcAsset, '2', '10')], prices, {
      currency: 'USD',
      now,
      staleAfterMs,
    });

    expect(valued.holdings[0].valuation.stale).toBe(true);
    expect(valued.holdings[0].valuation.currentValue).toBe('30');
    expect(valued.portfolio.stale).toBe(true);
  });

  it('does not mark a price stale at the exact threshold', () => {
    const asOf = new Date(now.getTime() - staleAfterMs);
    const prices = new Map<string, CachedPrice>([
      ['btc', { price: '15', asOf }],
    ]);

    const valued = valueHoldings([holding('a', btcAsset, '2', '10')], prices, {
      currency: 'USD',
      now,
      staleAfterMs,
    });

    expect(valued.holdings[0].valuation.stale).toBe(false);
  });

  it('returns null current value and PnL when no cached price exists', () => {
    const valued = valueHoldings(
      [holding('a', btcAsset, '2', '10')],
      new Map(),
      { currency: 'USD', now, staleAfterMs },
    );

    expect(valued.holdings[0].valuation).toMatchObject({
      price: null,
      stale: true,
      currentValue: null,
      costBasis: '20',
      unrealizedPnl: null,
      unrealizedPnlPct: null,
      allocationPct: null,
    });
    expect(valued.portfolio).toMatchObject({
      currentValue: '0',
      costBasis: '20',
      unrealizedPnl: null,
      stale: true,
    });
  });

  it('omits PnL percent when cost basis is zero', () => {
    const prices = new Map<string, CachedPrice>([
      ['btc', { price: '15', asOf: now }],
    ]);

    const valued = valueHoldings([holding('a', btcAsset, '2', '0')], prices, {
      currency: 'USD',
      now,
      staleAfterMs,
    });

    expect(valued.holdings[0].valuation.unrealizedPnl).toBe('30');
    expect(valued.holdings[0].valuation.unrealizedPnlPct).toBeNull();
    expect(valued.holdings[0].valuation.allocationPct).toBe('100');
  });

  it('splits portfolio allocation across current values', () => {
    const summaries = new Map<string, PortfolioValuation>([
      [
        'a',
        {
          currency: 'USD',
          currentValue: '30',
          costBasis: '20',
          unrealizedPnl: '10',
          unrealizedPnlPct: '50',
          allocationPct: null,
          stale: false,
        },
      ],
      [
        'b',
        {
          currency: 'USD',
          currentValue: '80',
          costBasis: '100',
          unrealizedPnl: '-20',
          unrealizedPnlPct: '-20',
          allocationPct: null,
          stale: false,
        },
      ],
    ]);

    assignPortfolioAllocations(summaries);

    expect(summaries.get('a')?.allocationPct).toBe('27.27272727');
    expect(summaries.get('b')?.allocationPct).toBe('72.72727273');
  });
});
