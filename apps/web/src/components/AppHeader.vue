<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuth } from '../auth/session'

defineProps<{
  title: string
  subtitle?: string
}>()

const route = useRoute()
const router = useRouter()
const auth = useAuth()

const navItems = [
  { label: 'Portfolios', to: '/portfolios' },
  { label: 'Profile', to: '/profile' },
]

const userInitial = computed(() => {
  const source =
    auth.state.user?.displayName?.trim() ||
    auth.state.user?.email?.trim() ||
    '?'

  return source.charAt(0).toUpperCase()
})

async function logout(): Promise<void> {
  await auth.logout()
  await router.replace('/login')
}
</script>

<template>
  <header class="mb-8">
    <div
      class="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex items-center gap-3">
        <div
          v-if="auth.state.user?.avatarUrl"
          class="h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-line"
        >
          <img
            :src="auth.state.user.avatarUrl"
            alt=""
            class="h-full w-full object-cover"
          />
        </div>
        <div
          v-else
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 font-display text-lg font-semibold text-brand ring-2 ring-brand/15"
        >
          {{ userInitial }}
        </div>

        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-ink">
            {{ auth.state.user?.displayName || 'Welcome back' }}
          </p>
          <p class="truncate text-xs text-ink-muted">
            {{ auth.state.user?.email }}
          </p>
        </div>
      </div>

      <button
        type="button"
        class="self-start rounded-lg border border-line-strong px-3 py-2 text-sm text-ink-soft transition hover:border-brand/30 hover:text-ink sm:self-auto"
        @click="logout"
      >
        Log out
      </button>
    </div>

    <div class="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="font-display text-3xl font-semibold tracking-tight text-ink">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="mt-1 text-sm text-ink-muted">{{ subtitle }}</p>
      </div>

      <nav
        class="inline-flex rounded-xl border border-line bg-surface-raised p-1 shadow-sm"
        aria-label="Main navigation"
      >
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="rounded-lg px-4 py-2 text-sm font-medium transition"
          :class="
            route.path === item.to
              ? 'bg-brand text-brand-contrast shadow-sm'
              : 'text-ink-muted hover:text-ink'
          "
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </div>
  </header>
</template>
