<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { ApiError, api } from '../api/client'
import type { CatalogAsset, Watchlist } from '../api/types'
import { useAuth } from '../auth/session'
import AppAlert from '../components/AppAlert.vue'
import AppHeader from '../components/AppHeader.vue'

const auth = useAuth()
const watchlist = ref<Watchlist | null>(null)
const query = ref('')
const results = ref<CatalogAsset[]>([])
const error = ref('')
const loading = ref(true)
const searching = ref(false)

function token(): string {
  const accessToken = auth.state.accessToken

  if (!accessToken) {
    throw new Error('Not signed in')
  }

  return accessToken
}

async function load(): Promise<void> {
  error.value = ''
  loading.value = true

  try {
    const lists = await api.listWatchlists(token())
    watchlist.value = lists[0] ?? null
  } catch (caught: unknown) {
    error.value = caught instanceof ApiError ? caught.message : 'Could not load the watchlist'
  } finally {
    loading.value = false
  }
}

async function search(): Promise<void> {
  if (query.value.trim().length < 2 || searching.value) {
    return
  }

  searching.value = true
  error.value = ''

  try {
    results.value = await api.searchAssets(token(), query.value.trim())
  } catch (caught: unknown) {
    error.value = caught instanceof ApiError ? caught.message : 'Search failed'
  } finally {
    searching.value = false
  }
}

async function add(asset: CatalogAsset): Promise<void> {
  if (!watchlist.value) {
    return
  }

  error.value = ''

  try {
    await api.addWatchlistItem(token(), watchlist.value.id, asset.id)
    results.value = []
    query.value = ''
    await load()
  } catch (caught: unknown) {
    error.value = caught instanceof ApiError ? caught.message : 'Could not add this asset'
  }
}

async function remove(assetId: string): Promise<void> {
  if (!watchlist.value) {
    return
  }

  error.value = ''

  try {
    await api.removeWatchlistItem(token(), watchlist.value.id, assetId)
    await load()
  } catch (caught: unknown) {
    error.value = caught instanceof ApiError ? caught.message : 'Could not remove this asset'
  }
}

function money(value: string | null): string {
  if (value === null) {
    return '—'
  }

  const numeric = Number(value)

  return Number.isFinite(numeric)
    ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(numeric)
    : value
}

function signedPercent(value: string | null): string {
  const numeric = Number(value)

  if (value === null || !Number.isFinite(numeric)) {
    return '—'
  }

  const text = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
    Math.abs(numeric),
  )

  if (numeric > 0) {
    return `+${text}%`
  }

  if (numeric < 0) {
    return `-${text}%`
  }

  return `${text}%`
}

function tone(value: string | null): string {
  const numeric = Number(value)

  if (!Number.isFinite(numeric) || numeric === 0) {
    return 'text-ink-muted'
  }

  return numeric > 0 ? 'text-success' : 'text-danger'
}

onMounted(() => {
  void load()
})
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-8 sm:py-10">
    <AppHeader
      title="Watchlist"
      subtitle="Follow a symbol without owning it. Prices come from the same cache as portfolios."
    />

    <AppAlert v-if="error" class="mb-4" variant="error">{{ error }}</AppAlert>

    <form class="mb-6 flex gap-2" @submit.prevent="search">
      <input
        v-model="query"
        type="search"
        placeholder="Search BTC, AAPL, SPY"
        class="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
      <button
        type="submit"
        class="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-contrast disabled:opacity-60"
        :disabled="searching || query.trim().length < 2"
      >
        {{ searching ? 'Searching…' : 'Search' }}
      </button>
    </form>

    <ul v-if="results.length" class="mb-6 grid gap-2">
      <li v-for="asset in results" :key="asset.id">
        <button
          type="button"
          class="flex w-full items-center justify-between rounded-xl border border-line bg-surface-raised px-4 py-3 text-left text-sm hover:border-brand/40"
          @click="add(asset)"
        >
          <span>
            <span class="font-semibold text-ink">{{ asset.symbol }}</span>
            <span class="ml-2 text-ink-muted">{{ asset.name }}</span>
          </span>
          <span class="text-xs uppercase tracking-wide text-brand">{{ asset.assetType }}</span>
        </button>
      </li>
    </ul>

    <p v-if="loading" class="text-sm text-ink-muted">Loading watchlist…</p>

    <ul v-else-if="watchlist" class="grid gap-3">
      <li
        v-if="watchlist.items.length === 0"
        class="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-sm text-ink-muted"
      >
        Nothing here yet. Search for a symbol and add it.
      </li>
      <li
        v-for="item in watchlist.items"
        :key="item.id"
        class="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex min-w-0 items-center gap-4">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 font-display text-lg font-semibold text-brand"
          >
            {{ item.asset.symbol.charAt(0) }}
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <router-link
                :to="`/assets/${item.asset.id}`"
                class="font-semibold text-ink hover:text-brand"
              >
                {{ item.asset.symbol }}
              </router-link>
              <span
                class="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-brand"
              >
                {{ item.asset.assetType }}
              </span>
              <span
                v-if="item.quote.stale"
                class="text-[11px] font-medium uppercase tracking-wide text-ink-muted"
              >
                Stale
              </span>
            </div>
            <p class="truncate text-sm text-ink-muted">{{ item.asset.name }}</p>
          </div>
        </div>
        <div class="flex items-center justify-between gap-4 sm:justify-end">
          <div class="text-left sm:text-right">
            <p class="font-medium text-ink">{{ money(item.quote.price) }}</p>
            <p class="text-sm" :class="tone(item.quote.changePercent24h)">
              {{ signedPercent(item.quote.changePercent24h) }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg border border-line-strong px-3 py-2 text-sm text-ink-soft hover:text-ink"
            @click="remove(item.asset.id)"
          >
            Remove
          </button>
        </div>
      </li>
    </ul>
  </main>
</template>
