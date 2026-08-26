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

const error = ref('')
const pending = ref(false)

async function confirm(): Promise<void> {
  error.value = ''
  pending.value = true

  try {
    await auth.confirmGoogleLink(linkToken.value)
    await router.replace('/profile')
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
        An account with this email already exists. Confirm to attach Google
        sign-in to that account.
      </p>

      <p v-if="!linkToken" class="mt-4 text-sm text-danger">
        Missing link token. Start Google sign-in again.
      </p>
      <p v-else-if="error" class="mt-4 text-sm text-danger">{{ error }}</p>

      <button
        type="button"
        :disabled="!linkToken || pending"
        class="mt-6 w-full rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-contrast disabled:opacity-60"
        @click="confirm"
      >
        {{ pending ? 'Linking…' : 'Confirm account linking' }}
      </button>

      <router-link
        to="/login"
        class="mt-4 block text-center text-sm text-ink-muted underline"
      >
        Cancel
      </router-link>
    </section>
  </main>
</template>
