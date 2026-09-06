import type {
  AuthenticationResult,
  CreateHoldingInput,
  Holding,
  Portfolio,
  PortfolioNameInput,
  PublicUser,
  UpdateProfileInput,
} from './types'

export const apiUrl = import.meta.env.VITE_API_URL ?? '/api/v1'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

type AuthSessionBridge = {
  setSession: (result: AuthenticationResult) => void
  clearSession: () => void
}

type RequestOptions = RequestInit & {
  accessToken?: string | null
  /** Skip 401 refresh/retry (used for auth endpoints and the retry itself). */
  skipAuthRetry?: boolean
}

let authBridge: AuthSessionBridge | null = null
let refreshInFlight: Promise<string | null> | null = null

/** Wire session state updates without a circular import from session → client. */
export function registerAuthBridge(bridge: AuthSessionBridge): void {
  authBridge = bridge
}

function readErrorMessage(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null || !('message' in body)) {
    return fallback
  }

  const message = body.message

  if (typeof message === 'string') {
    return message
  }

  if (Array.isArray(message)) {
    return message.map(String).join(', ')
  }

  return fallback
}

function isAuthEndpoint(path: string): boolean {
  return path.startsWith('/auth/')
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const result = await request<AuthenticationResult>('/auth/refresh', {
          method: 'POST',
          skipAuthRetry: true,
        })

        if (!result?.accessToken) {
          authBridge?.clearSession()
          return null
        }

        authBridge?.setSession(result)
        return result.accessToken
      } catch {
        authBridge?.clearSession()
        return null
      } finally {
        refreshInFlight = null
      }
    })()
  }

  return refreshInFlight
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { accessToken, skipAuthRetry, ...init } = options
  const headers = new Headers(init.headers)

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (response.status === 204) {
    return undefined as T
  }

  const body: unknown = await response.json().catch(() => null)

  if (
    response.status === 401 &&
    accessToken &&
    !skipAuthRetry &&
    !isAuthEndpoint(path)
  ) {
    const nextToken = await refreshAccessToken()

    if (nextToken) {
      return request<T>(path, {
        ...options,
        accessToken: nextToken,
        skipAuthRetry: true,
      })
    }
  }

  if (!response.ok) {
    throw new ApiError(
      readErrorMessage(body, `Request failed (${response.status})`),
      response.status,
      body,
    )
  }

  return body as T
}

export const api = {
  register(email: string, password: string) {
    return request<AuthenticationResult>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuthRetry: true,
    })
  },

  login(email: string, password: string) {
    return request<AuthenticationResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuthRetry: true,
    })
  },

  refresh() {
    return request<AuthenticationResult>('/auth/refresh', {
      method: 'POST',
      skipAuthRetry: true,
    })
  },

  logout() {
    return request<void>('/auth/logout', {
      method: 'POST',
      skipAuthRetry: true,
    })
  },

  confirmGoogleLink(linkToken: string, password: string) {
    return request<AuthenticationResult>('/auth/google/link', {
      method: 'POST',
      body: JSON.stringify({ linkToken, password }),
      skipAuthRetry: true,
    })
  },

  getMe(accessToken: string) {
    return request<PublicUser>('/users/me', {
      accessToken,
    })
  },

  updateMe(accessToken: string, input: UpdateProfileInput) {
    return request<PublicUser>('/users/me', {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify(input),
    })
  },

  listPortfolios(accessToken: string) {
    return request<Portfolio[]>('/portfolios', { accessToken })
  },

  createPortfolio(accessToken: string, input: PortfolioNameInput) {
    return request<Portfolio>('/portfolios', {
      method: 'POST',
      accessToken,
      body: JSON.stringify(input),
    })
  },

  updatePortfolio(
    accessToken: string,
    portfolioId: string,
    input: PortfolioNameInput,
  ) {
    return request<Portfolio>(`/portfolios/${portfolioId}`, {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify(input),
    })
  },

  getPortfolio(accessToken: string, portfolioId: string) {
    return request<Portfolio>(`/portfolios/${portfolioId}`, { accessToken })
  },

  deletePortfolio(accessToken: string, portfolioId: string) {
    return request<void>(`/portfolios/${portfolioId}`, {
      method: 'DELETE',
      accessToken,
    })
  },

  listHoldings(accessToken: string, portfolioId: string) {
    return request<Holding[]>(`/portfolios/${portfolioId}/holdings`, {
      accessToken,
    })
  },

  createHolding(
    accessToken: string,
    portfolioId: string,
    input: CreateHoldingInput,
  ) {
    return request<Holding>(`/portfolios/${portfolioId}/holdings`, {
      method: 'POST',
      accessToken,
      body: JSON.stringify(input),
    })
  },
}

export function googleAuthUrl(): string {
  return `${apiUrl}/auth/google`
}
