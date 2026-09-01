<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuth } from '../auth/session'

const router = useRouter()
const auth = useAuth()
const checking = ref(true)

onMounted(async () => {
  // Router guard already tried restoreSession; retry once in case of race.
  if (!auth.isAuthenticated.value) {
    await auth.restoreSession()
  }

  checking.value = false

  if (auth.isAuthenticated.value) {
    await router.replace('/portfolios')
  }
})
</script>

<template>
  <main class="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4">
    <section
      class="rounded-2xl border border-line bg-surface-raised p-8 text-center shadow-sm"
    >
      <template v-if="checking">
        <div
          class="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-line border-t-brand"
          aria-hidden="true"
        />
        <h1 class="mt-4 font-display text-xl font-semibold text-ink">
          Finishing sign-in…
        </h1>
        <p class="mt-2 text-sm text-ink-muted">Restoring your session.</p>
      </template>

      <template v-else>
        <h1 class="font-display text-xl font-semibold text-ink">
          Google sign-in did not complete
        </h1>
        <p class="mt-2 text-sm text-ink-muted">
          The session cookie was not set on this site. Ensure
          <code class="text-ink-soft">GOOGLE_REDIRECT_URI</code> uses the
          <strong>web</strong> URL (same origin as the app), e.g.
          <code class="block mt-2 break-all text-xs text-ink-soft"
            >https://web-dev-98e7.up.railway.app/api/v1/auth/google/callback</code
          >
        </p>
        <router-link
          to="/login"
          class="mt-4 inline-block text-sm font-medium text-brand underline"
        >
          Back to sign in
        </router-link>
      </template>
    </section>
  </main>
</template>
