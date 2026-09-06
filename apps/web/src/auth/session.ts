import { computed, reactive } from 'vue'

import { api, registerAuthBridge } from '../api/client'
import type { AuthenticationResult, PublicUser } from '../api/types'

const state = reactive({
  accessToken: null as string | null,
  user: null as PublicUser | null,
  ready: false,
})

function applySession(result: AuthenticationResult): void {
  state.accessToken = result.accessToken
  state.user = result.user
  state.ready = true
}

function clearSession(): void {
  state.accessToken = null
  state.user = null
}

registerAuthBridge({
  setSession: applySession,
  clearSession,
})

export function useAuth() {
  const isAuthenticated = computed(() => Boolean(state.accessToken && state.user))

  async function restoreSession(): Promise<void> {
    if (state.ready || state.accessToken) {
      state.ready = true
      return
    }

    try {
      const result = await api.refresh()

      if (!result?.accessToken) {
        clearSession()
        return
      }

      applySession(result)
    } catch {
      clearSession()
    } finally {
      state.ready = true
    }
  }

  async function register(email: string, password: string): Promise<void> {
    applySession(await api.register(email, password))
  }

  async function login(email: string, password: string): Promise<void> {
    applySession(await api.login(email, password))
  }

  async function confirmGoogleLink(
    linkToken: string,
    password: string,
  ): Promise<void> {
    applySession(await api.confirmGoogleLink(linkToken, password))
  }

  async function logout(): Promise<void> {
    try {
      await api.logout()
    } finally {
      clearSession()
    }
  }

  async function saveProfile(input: {
    displayName: string
    avatarUrl: string
    defaultCurrency: 'USD' | 'EUR'
  }): Promise<void> {
    if (!state.accessToken) {
      throw new Error('Not authenticated')
    }

    state.user = await api.updateMe(state.accessToken, {
      displayName: input.displayName.trim() || null,
      avatarUrl: input.avatarUrl.trim() || null,
      defaultCurrency: input.defaultCurrency,
    })
  }

  return {
    state,
    isAuthenticated,
    restoreSession,
    register,
    login,
    confirmGoogleLink,
    logout,
    saveProfile,
  }
}
