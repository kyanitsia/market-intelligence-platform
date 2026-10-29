import type { HoldingValuation } from '../valuation/valuation.types';

export const ASSET_TYPES = ['CRYPTO', 'STOCK', 'ETF'] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const DEFAULT_ASSET_PROVIDERS: Record<AssetType, string> = {
  CRYPTO: 'coingecko',
  STOCK: 'finnhub',
  ETF: 'finnhub',
};

export type HoldingAssetInput = {
  symbol: string;
  externalId: string;
  assetType: AssetType;
  name?: string;
  externalProvider?: string;
};

export type HoldingAssetResponse = {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  externalProvider: string;
  externalId: string;
  status: AssetStatus;
};

export type HoldingResponse = {
  id: string;
  portfolioId: string;
  quantity: string;
  avgCostBasis: string;
  acquiredOn: string;
  asset: HoldingAssetResponse;
  valuation: HoldingValuation;
};
