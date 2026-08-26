import type {
  AuthenticationResult,
  PublicUser,
  UpdateProfileInput,
} from './types'

export const apiUrl =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
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

async function request<T>(
  path: string,
  options: RequestInit & { accessToken?: string | null } = {},
): Promise<T> {
  const headers = new Headers(options.headers)

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`)
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (response.status === 204) {
    return undefined as T
  }

  const body: unknown = await response.json().catch(() => null)

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
    })
  },

  login(email: string, password: string) {
    return request<AuthenticationResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  refresh() {
    return request<AuthenticationResult>('/auth/refresh', {
      method: 'POST',
    })
  },

  logout() {
    return request<void>('/auth/logout', {
      method: 'POST',
    })
  },

  confirmGoogleLink(linkToken: string) {
    return request<AuthenticationResult>('/auth/google/link', {
      method: 'POST',
      body: JSON.stringify({ linkToken }),
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
}

export function googleAuthUrl(): string {
  return `${apiUrl}/auth/google`
}
