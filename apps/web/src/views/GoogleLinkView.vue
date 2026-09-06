<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '../api/client'
import { useAuth } from '../auth/session'

const route = useRoute()
const router = useRouter()
const auth = useAuth()

const linkToken = computed(() => {
  const value = route.query.linkToken
  return typeof value === 'string' ? value : ''
})

const password = ref('')
const error = ref('')
const pending = ref(false)

async function confirm(): Promise<void> {
  if (!linkToken.value || !password.value || pending.value) {
    return
  }

  error.value = ''
  pending.value = true

  try {
    await auth.confirmGoogleLink(linkToken.value, password.value)
    await router.replace('/portfolios')
  } catch (caught: unknown) {
    error.value =
      caught instanceof ApiError
        ? caught.message
        : 'Could not link this account'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <main class="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4">
    <section
      class="rounded-2xl border border-line bg-surface-raised p-8 shadow-sm"
    >
      <h1 class="font-display text-xl font-semibold text-ink">
        Link Google to your account
      </h1>
      <p class="mt-2 text-sm text-ink-muted">
        An account with this email already exists. Enter that account’s password
        to attach Google sign-in.
      </p>

      <p v-if="!linkToken" class="mt-4 text-sm text-danger">
        Missing link token. Start Google sign-in again.
      </p>

      <form v-else class="mt-6 space-y-4" @submit.prevent="confirm">
        <label class="block text-sm font-medium text-ink-soft">
          Account password
          <input
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>

        <p v-if="error" class="text-sm text-danger">{{ error }}</p>

        <button
          type="submit"
          :disabled="!password || pending"
          class="w-full rounded-xl bg-brand px-3 py-2.5 text-sm font-medium text-brand-contrast transition hover:bg-brand/90 disabled:opacity-60"
        >
          {{ pending ? 'Linking…' : 'Confirm account linking' }}
        </button>
      </form>

      <router-link
        to="/login"
        class="mt-4 block text-center text-sm text-ink-muted underline"
      >
        Cancel
      </router-link>
    </section>
  </main>
</template>
