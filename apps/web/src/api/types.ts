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

export interface Portfolio {
  id: string
  name: string
  version: number
  visibility: 'PRIVATE' | 'PUBLIC' | 'FOLLOWERS_ONLY'
  shareMode: 'FULL' | 'ALLOCATION_ONLY' | 'HIDDEN'
  createdAt: string
  updatedAt: string
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
