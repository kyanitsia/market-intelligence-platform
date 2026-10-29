import type { Asset } from '../../database/schema';
import { CoinGeckoProvider } from './coingecko.provider';
import { FinnhubProvider } from './finnhub.provider';
import { MarketDataService } from './market-data.service';
import { candlesFromPoints, MarketDataError } from './market-data';

const crypto: Asset = {
  id: 'btc-id',
  symbol: 'BTC',
  name: 'Bitcoin',
  assetType: 'CRYPTO',
  externalProvider: 'coingecko',
  externalId: 'bitcoin',
  status: 'ACTIVE',
};

const stock: Asset = {
  id: 'aapl-id',
  symbol: 'AAPL',
  name: 'Apple',
  assetType: 'STOCK',
  externalProvider: 'finnhub',
  externalId: 'AAPL',
  status: 'ACTIVE',
};

function config(values: Record<string, string>) {
  return { get: (key: string) => values[key] };
}

describe('market data providers', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('normalizes a CoinGecko market row and requests the external id', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          current_price: 65000.5,
          price_change_24h: 100,
          price_change_percentage_24h: 0.15,
          total_volume: 1000,
          high_24h: 66000,
          low_24h: 64000,
        },
      ],
    });

    const provider = new CoinGeckoProvider();
    const snapshot = await provider.getLatestPrice(crypto);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toContain(
      'https://api.coingecko.com/api/v3/coins/markets?',
    );
    expect(url).toContain('ids=bitcoin');
    expect(init.headers).not.toHaveProperty('x-cg-demo-api-key');
    expect(snapshot).toMatchObject({
      assetId: 'btc-id',
      symbol: 'BTC',
      price: 65000.5,
      currency: 'USD',
      change24h: 100,
      source: 'coingecko',
    });
  });

  it('buckets CoinGecko price points into daily candles', () => {
    const candles = candlesFromPoints(
      'btc-id',
      '1d',
      [
        [Date.parse('2026-01-02T01:00:00.000Z'), 10],
        [Date.parse('2026-01-02T12:00:00.000Z'), 14],
        [Date.parse('2026-01-03T00:00:00.000Z'), 9],
      ],
      [
        [Date.parse('2026-01-02T01:00:00.000Z'), 2],
        [Date.parse('2026-01-02T12:00:00.000Z'), 3],
      ],
    );

    expect(candles).toEqual([
      {
        assetId: 'btc-id',
        interval: '1d',
        timestamp: '2026-01-02T00:00:00.000Z',
        open: 10,
        high: 14,
        low: 10,
        close: 14,
        volume: 5,
      },
      {
        assetId: 'btc-id',
        interval: '1d',
        timestamp: '2026-01-03T00:00:00.000Z',
        open: 9,
        high: 9,
        low: 9,
        close: 9,
        volume: null,
      },
    ]);
  });

  it('normalizes a Finnhub quote and daily candles by symbol', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ c: 190.25, d: 1.5, dp: 0.8, h: 191, l: 188 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          s: 'ok',
          t: [1_767_225_600],
          o: [180],
          h: [191],
          l: [179],
          c: [190],
          v: [1000],
        }),
      });

    const provider = new FinnhubProvider(
      config({
        FINNHUB_API_URL: 'https://finnhub.io/api/v1',
        FINNHUB_API_KEY: 'token',
      }) as never,
    );
    const snapshot = await provider.getLatestPrice(stock);
    const candles = await provider.getPriceHistory(stock, {
      interval: '1d',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
    });
    const quoteUrl = fetchMock.mock.calls[0][0] as string;
    const candleUrl = fetchMock.mock.calls[1][0] as string;

    expect(quoteUrl).toContain('/quote?');
    expect(quoteUrl).toContain('symbol=AAPL');
    expect(quoteUrl).toContain('token=token');
    expect(candleUrl).toContain('resolution=D');
    expect(snapshot).toMatchObject({
      assetId: 'aapl-id',
      price: 190.25,
      change24h: 1.5,
      high24h: 191,
      low24h: 188,
      volume24h: null,
      source: 'finnhub',
    });
    expect(candles).toEqual([
      {
        assetId: 'aapl-id',
        interval: '1d',
        timestamp: new Date(1_767_225_600 * 1000).toISOString(),
        open: 180,
        high: 191,
        low: 179,
        close: 190,
        volume: 1000,
      },
    ]);
  });

  it('selects CoinGecko for crypto and Finnhub for stocks and ETFs', async () => {
    const coingecko = { getLatestPrice: jest.fn().mockResolvedValue({ source: 'coingecko' }) };
    const finnhub = { getLatestPrice: jest.fn().mockResolvedValue({ source: 'finnhub' }) };
    const service = new MarketDataService(coingecko as never, finnhub as never);

    await service.getLatestPrice(crypto);
    await service.getLatestPrice(stock);
    await service.getLatestPrice({ ...stock, assetType: 'ETF', symbol: 'SPY' });

    expect(coingecko.getLatestPrice).toHaveBeenCalledTimes(1);
    expect(finnhub.getLatestPrice).toHaveBeenCalledTimes(2);
  });

  it('skips a provider error when loading several latest prices', async () => {
    const coingecko = {
      getLatestPrice: jest
        .fn()
        .mockRejectedValue(new MarketDataError('coingecko', 'down')),
    };
    const service = new MarketDataService(coingecko as never, {} as never);

    await expect(service.getLatestPrices([crypto])).resolves.toEqual([]);
  });
});
