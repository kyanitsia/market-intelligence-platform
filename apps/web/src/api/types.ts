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
