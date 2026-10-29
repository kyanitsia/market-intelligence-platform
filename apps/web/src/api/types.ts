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
