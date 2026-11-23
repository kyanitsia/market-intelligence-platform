export type CatalogHit = {
  symbol: string;
  name: string;
  assetType: 'CRYPTO' | 'STOCK' | 'ETF';
  externalProvider: 'coingecko' | 'finnhub';
  externalId: string;
};

type CoinHit = { id?: string; symbol?: string; name?: string };

type ListingHit = { symbol?: string; description?: string; type?: string };

export function hitsFromCoinGecko(coins: CoinHit[]): CatalogHit[] {
  return coins
    .flatMap((coin) => {
      const externalId = coin.id?.trim();
      const symbol = coin.symbol?.trim().toUpperCase();
      const name = coin.name?.trim();

      if (!externalId || !symbol || !name) {
        return [];
      }

      return [
        {
          symbol,
          name,
          assetType: 'CRYPTO' as const,
          externalProvider: 'coingecko' as const,
          externalId,
        },
      ];
    })
    .slice(0, 8);
}

export function hitsFromFinnhub(rows: ListingHit[]): CatalogHit[] {
  return rows
    .flatMap((row) => {
      const symbol = row.symbol?.trim().toUpperCase();
      const name = row.description?.trim() || symbol;
      const assetType = listedType(row.type);

      if (!symbol || !name || !assetType) {
        return [];
      }

      return [
        {
          symbol,
          name,
          assetType,
          externalProvider: 'finnhub' as const,
          externalId: symbol,
        },
      ];
    })
    .slice(0, 8);
}

function listedType(type: string | undefined): 'STOCK' | 'ETF' | null {
  const value = (type ?? '').toLowerCase();

  if (value.includes('etp') || value.includes('etf')) {
    return 'ETF';
  }

  if (value.includes('stock') || value.includes('equity')) {
    return 'STOCK';
  }

  return null;
}
