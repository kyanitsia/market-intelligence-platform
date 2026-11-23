import { hitsFromCoinGecko, hitsFromFinnhub } from './asset-search';

describe('asset search hits', () => {
  it('keeps crypto slugs and listed stocks or ETFs', () => {
    expect(
      hitsFromCoinGecko([
        { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
        { id: '', symbol: 'eth', name: 'Ether' },
      ]),
    ).toEqual([
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        assetType: 'CRYPTO',
        externalProvider: 'coingecko',
        externalId: 'bitcoin',
      },
    ]);

    expect(
      hitsFromFinnhub([
        { symbol: 'AAPL', description: 'Apple Inc', type: 'Common Stock' },
        { symbol: 'SPY', description: 'SPDR S&P 500', type: 'ETP' },
        { symbol: 'BRK.A', description: 'Berkshire', type: 'ADR' },
      ]),
    ).toEqual([
      {
        symbol: 'AAPL',
        name: 'Apple Inc',
        assetType: 'STOCK',
        externalProvider: 'finnhub',
        externalId: 'AAPL',
      },
      {
        symbol: 'SPY',
        name: 'SPDR S&P 500',
        assetType: 'ETF',
        externalProvider: 'finnhub',
        externalId: 'SPY',
      },
    ]);
  });
});