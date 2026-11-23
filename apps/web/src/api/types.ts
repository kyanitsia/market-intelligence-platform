export interface PublicUser {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  defaultCurrency: 'USD' | 'EUR'
  createdAt: string
}

export interface AuthenticationResult {
  accessToken: string
  user: PublicUser
}

export interface UpdateProfileInput {
  displayName?: string | null
  avatarUrl?: string | null
  defaultCurrency?: 'USD' | 'EUR'
}

export interface HoldingValuation {
  currency: 'USD' | 'EUR'
  price: string | null
  priceAsOf: string | null
  change24h: string | null
  changePercent24h: string | null
  volume24h: string | null
  high24h: string | null
  low24h: string | null
  stale: boolean
  currentValue: string | null
  costBasis: string
  unrealizedPnl: string | null
  unrealizedPnlPct: string | null
  allocationPct: string | null
}

export interface PortfolioValuation {
  currency: 'USD' | 'EUR'
  currentValue: string
  costBasis: string
  unrealizedPnl: string | null
  unrealizedPnlPct: string | null
  allocationPct: string | null
  stale: boolean
}

export interface Portfolio {
  id: string
  name: string
  version: number
  visibility: 'PRIVATE' | 'PUBLIC' | 'FOLLOWERS_ONLY'
  shareMode: 'FULL' | 'ALLOCATION_ONLY' | 'HIDDEN'
  createdAt: string
  updatedAt: string
  valuation: PortfolioValuation
}

export interface PortfolioNameInput {
  name: string
}

export type AssetType = 'CRYPTO' | 'STOCK' | 'ETF'

export interface HoldingAsset {
  id: string
  symbol: string
  name: string
  assetType: AssetType
  externalProvider: string
  externalId: string
  status: 'ACTIVE' | 'INACTIVE'
}

export interface Holding {
  id: string
  portfolioId: string
  quantity: string
  avgCostBasis: string
  acquiredOn: string
  asset: HoldingAsset
  valuation: HoldingValuation
}

export interface CreateHoldingInput {
  asset: {
    symbol: string
    externalId: string
    assetType: AssetType
    name?: string
    externalProvider?: string
  }
  quantity: string
  avgCostBasis: string
  acquiredOn: string
}

export interface LedgerTransaction {
  id: string
  portfolioId: string
  assetId: string
  type: 'BUY' | 'SELL'
  quantity: string
  price: string
  realizedPnl: string | null
  occurredAt: string
  createdAt: string
}

export interface SellHoldingInput {
  quantity: string
  price: string
  occurredAt?: string
}

export interface SellHoldingResult {
  transaction: LedgerTransaction
  holding: Holding | null
}

export interface AssetQuote {
  currency: 'USD'
  price: string | null
  priceAsOf: string | null
  stale: boolean
  change24h: string | null
  changePercent24h: string | null
  volume24h: string | null
  high24h: string | null
  low24h: string | null
}

export interface CatalogAsset {
  id: string
  symbol: string
  name: string
  assetType: AssetType
  externalProvider: string
  externalId: string
  status: 'ACTIVE' | 'INACTIVE'
}

export interface AssetStats extends CatalogAsset {
  quote: AssetQuote
}

export type ChartRange = '1D' | '1W' | '1M' | '1Y'

export interface CandlePoint {
  timestamp: string
  open: string
  high: string
  low: string
  close: string
  volume: string | null
}

export interface AssetHistory {
  assetId: string
  range: ChartRange
  interval: '1d'
  candles: CandlePoint[]
  latest: AssetQuote
  priorClose: string | null
}

export interface WatchlistItem {
  id: string
  createdAt: string
  asset: CatalogAsset
  quote: AssetQuote
}

export interface Watchlist {
  id: string
  name: string
  items: WatchlistItem[]
}

export interface PriceAlert {
  id: string
  operator: 'GTE' | 'LTE'
  targetPrice: string
  active: boolean
  lastTriggeredAt: string | null
  cooldownMinutes: number
  createdAt: string
  asset: CatalogAsset
}

export interface AppNotification {
  id: string
  type: string
  payload: {
    alertId: string
    assetId: string
    symbol: string
    price: string
    operator: 'GTE' | 'LTE'
    targetPrice: string
  }
  readAt: string | null
  createdAt: string
}
