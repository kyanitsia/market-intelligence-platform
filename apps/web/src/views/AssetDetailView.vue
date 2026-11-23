<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError, api } from '../api/client'
import type { AssetHistory, AssetStats, ChartRange } from '../api/types'
import { useAuth } from '../auth/session'
import AppAlert from '../components/AppAlert.vue'
import AppHeader from '../components/AppHeader.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const stats = ref<AssetStats | null>(null)
const history = ref<AssetHistory | null>(null)
const range = ref<ChartRange>('1M')
const error = ref('')
const ranges: ChartRange[] = ['1D', '1W', '1M', '1Y']

const assetId = computed(() => String(route.params.id ?? ''))

const chartCloses = computed(() => {
  const closes =
    range.value === '1D'
      ? [history.value?.priorClose, history.value?.latest.price].filter(
          (value): value is string => value !== null && value !== undefined,
        )
      : (history.value?.candles.map((candle) => candle.close) ?? [])

  return closes.map(Number).filter((value) => Number.isFinite(value))
})

const chartUp = computed(() => {
  const values = chartCloses.value

  if (values.length < 2) {
    return true
  }

  return values[values.length - 1] >= values[0]
})

const chartPoints = computed(() => {
  const numeric = chartCloses.value

  if (numeric.length === 0) {
    return ''
  }

  const min = Math.min(...numeric)
  const max = Math.max(...numeric)
  const span = max - min || 1

  return numeric
    .map((close, index) => {
      const x = numeric.length === 1 ? 50 : (index / (numeric.length - 1)) * 100
      const y = 36 - ((close - min) / span) * 32
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
})

const chartArea = computed(() => {
  if (!chartPoints.value) {
    return ''
  }

  return `0,40 ${chartPoints.value} 100,40`
})

function token(): string {
  const accessToken = auth.state.accessToken

  if (!accessToken) {
    throw new Error('Not signed in')
  }

  return accessToken
}

async function load(): Promise<void> {
  error.value = ''

  try {
    const accessToken = token()
    const [loadedStats, loadedHistory] = await Promise.all([
      api.getAssetStats(accessToken, assetId.value),
      api.getAssetPrices(accessToken, assetId.value, range.value),
    ])
    stats.value = loadedStats
    history.value = loadedHistory
  } catch (caught: unknown) {
    error.value = caught instanceof ApiError ? caught.message : 'Could not load this asset'
  }
}

function money(value: string | null): string {
  if (value === null) {
    return '—'
  }

  const numeric = Number(value)

  return Number.isFinite(numeric)
    ? new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      }).format(numeric)
    : value
}

function signedPercent(value: string | null): string {
  const numeric = Number(value)

  if (value === null || !Number.isFinite(numeric)) {
    return '—'
  }

  const text = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(Math.abs(numeric))

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
    return 'text-ink'
  }

  return numeric > 0 ? 'text-success' : 'text-danger'
}

function compact(value: string | null): string {
  const numeric = Number(value)

  if (value === null || !Number.isFinite(numeric)) {
    return '—'
  }

  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(numeric)
}

onMounted(() => {
  void load()
})

watch([assetId, range], () => {
  void load()
})
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-8 sm:py-10">
    <AppHeader
      :title="stats?.symbol ?? 'Asset'"
      :subtitle="stats ? `${stats.name} · ${stats.assetType}` : 'Daily price history'"
    />

    <p class="mb-6">
      <button
        type="button"
        class="text-sm text-ink-muted underline decoration-line underline-offset-2 hover:text-ink"
        @click="router.back()"
      >
        Back
      </button>
    </p>

    <AppAlert v-if="error" class="mb-4" variant="error">{{ error }}</AppAlert>

    <section v-if="stats" class="mb-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-sm">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <p class="font-display text-3xl font-semibold text-ink">
          {{ money(stats.quote.price) }}
        </p>
        <p class="text-lg font-semibold" :class="tone(stats.quote.changePercent24h)">
          {{ signedPercent(stats.quote.changePercent24h) }}
          <span class="ml-1 text-xs font-medium uppercase tracking-wide text-ink-muted">24h</span>
        </p>
      </div>
      <p v-if="stats.quote.stale" class="mt-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
        Stale price
      </p>
      <dl class="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div class="rounded-xl bg-surface px-3 py-2">
          <dt class="text-xs uppercase tracking-wide text-ink-muted">High</dt>
          <dd class="mt-0.5 font-medium text-ink">{{ money(stats.quote.high24h) }}</dd>
        </div>
        <div class="rounded-xl bg-surface px-3 py-2">
          <dt class="text-xs uppercase tracking-wide text-ink-muted">Low</dt>
          <dd class="mt-0.5 font-medium text-ink">{{ money(stats.quote.low24h) }}</dd>
        </div>
        <div class="rounded-xl bg-surface px-3 py-2">
          <dt class="text-xs uppercase tracking-wide text-ink-muted">Volume</dt>
          <dd class="mt-0.5 font-medium text-ink">{{ compact(stats.quote.volume24h) }}</dd>
        </div>
      </dl>
    </section>

    <div class="mb-3 inline-flex rounded-xl border border-line bg-surface-raised p-1 shadow-sm">
      <button
        v-for="option in ranges"
        :key="option"
        type="button"
        class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
        :class="option === range ? 'bg-brand text-brand-contrast' : 'text-ink-muted hover:text-ink'"
        @click="range = option"
      >
        {{ option }}
      </button>
    </div>

    <section class="rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
      <svg
        v-if="chartCloses.length > 1"
        viewBox="0 0 100 40"
        class="h-48 w-full"
        preserveAspectRatio="none"
        role="img"
        :aria-label="`${range} price chart`"
      >
        <polygon :points="chartArea" :class="chartUp ? 'fill-success/15' : 'fill-danger/15'" />
        <polyline
          :points="chartPoints"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
          stroke-linecap="round"
          :class="chartUp ? 'text-success' : 'text-danger'"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <p v-else class="py-10 text-center text-sm text-ink-muted">
        Daily history is not stored yet. The next price poll fills the last year.
      </p>
      <p v-if="range === '1D' && history" class="mt-2 text-xs text-ink-muted">
        1D uses the latest cached price and the prior close.
        <span v-if="history.priorClose"> Prior close {{ money(history.priorClose) }}.</span>
      </p>
    </section>
  </main>
</template>
