<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError, api } from '../api/client'
import type { AssetType, Holding, Portfolio } from '../api/types'
import { useAuth } from '../auth/session'
import AppAlert from '../components/AppAlert.vue'
import AppHeader from '../components/AppHeader.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuth()

const portfolioId = computed(() => String(route.params.id ?? ''))

const portfolio = ref<Portfolio | null>(null)
const holdings = ref<Holding[]>([])
const error = ref('')
const success = ref('')
const loading = ref(true)
const creating = ref(false)

const form = reactive({
  assetType: 'CRYPTO' as AssetType,
  symbol: '',
  externalId: '',
  name: '',
  quantity: '',
  avgCostBasis: '',
  acquiredOn: todayIsoDate(),
})

let successTimer: ReturnType<typeof setTimeout> | undefined

const assetTypes: AssetType[] = ['CRYPTO', 'STOCK', 'ETF']

const canSubmit = computed(() => {
  return (
    form.symbol.trim().length > 0 &&
    form.externalId.trim().length > 0 &&
    isPositiveDecimal(form.quantity) &&
    isNonNegativeDecimal(form.avgCostBasis) &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.acquiredOn)
  )
})

function requireToken(): string {
  const token = auth.state.accessToken

  if (!token) {
    throw new Error('Not signed in')
  }

  return token
}

function todayIsoDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${now.getFullYear()}-${month}-${day}`
}

function isPositiveDecimal(value: string): boolean {
  const trimmed = value.trim()

  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(trimmed)) {
    return false
  }

  return Number(trimmed) > 0
}

function isNonNegativeDecimal(value: string): boolean {
  const trimmed = value.trim()

  return /^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(trimmed)
}

function showSuccess(message: string): void {
  success.value = message
  clearTimeout(successTimer)
  successTimer = setTimeout(() => {
    success.value = ''
  }, 3200)
}

function formatIsoDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function formatDecimal(value: string): string {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return value
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 8,
  }).format(numeric)
}

function resetForm(): void {
  form.symbol = ''
  form.externalId = ''
  form.name = ''
  form.quantity = ''
  form.avgCostBasis = ''
  form.acquiredOn = todayIsoDate()
}

async function load(): Promise<void> {
  error.value = ''
  loading.value = true

  try {
    const token = requireToken()
    const [loadedPortfolio, loadedHoldings] = await Promise.all([
      api.getPortfolio(token, portfolioId.value),
      api.listHoldings(token, portfolioId.value),
    ])

    portfolio.value = loadedPortfolio
    holdings.value = loadedHoldings
  } catch (caught: unknown) {
    if (caught instanceof ApiError && caught.status === 404) {
      error.value = 'Portfolio not found'
      return
    }

    error.value =
      caught instanceof ApiError
        ? caught.message
        : 'Could not load this portfolio'
  } finally {
    loading.value = false
  }
}

async function addHolding(): Promise<void> {
  if (!canSubmit.value || creating.value) {
    return
  }

  error.value = ''
  creating.value = true

  try {
    const created = await api.createHolding(requireToken(), portfolioId.value, {
      asset: {
        symbol: form.symbol.trim(),
        externalId: form.externalId.trim(),
        assetType: form.assetType,
        name: form.name.trim() || undefined,
      },
      quantity: form.quantity.trim(),
      avgCostBasis: form.avgCostBasis.trim(),
      acquiredOn: form.acquiredOn,
    })

    holdings.value = [...holdings.value, created].sort((left, right) =>
      left.asset.symbol.localeCompare(right.asset.symbol),
    )
    resetForm()
    showSuccess(`Added ${created.asset.symbol}.`)
  } catch (caught: unknown) {
    error.value =
      caught instanceof ApiError ? caught.message : 'Could not add holding'
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  if (!portfolioId.value) {
    void router.replace('/portfolios')
    return
  }

  void load()
})
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-8 sm:py-10">
    <AppHeader
      :title="portfolio?.name ?? 'Portfolio'"
      subtitle="Add holdings with asset identity, quantity, cost basis, and acquisition date."
    />

    <p class="mb-6">
      <router-link
        to="/portfolios"
        class="text-sm text-ink-muted underline decoration-line underline-offset-2 hover:text-ink"
      >
        Back to portfolios
      </router-link>
    </p>

    <div v-if="success" class="mb-4 animate-fade-in">
      <AppAlert variant="success">{{ success }}</AppAlert>
    </div>

    <div v-if="error" class="mb-4">
      <AppAlert variant="error">{{ error }}</AppAlert>
    </div>

    <section
      class="rounded-2xl border border-line bg-surface-raised p-5 shadow-sm sm:p-6"
    >
      <h2 class="font-display text-lg font-semibold text-ink">Add holding</h2>
      <p class="mt-1 text-sm text-ink-muted">
        Assets are identified by canonical symbol and external ID. Types:
        CRYPTO, STOCK, ETF.
      </p>

      <form class="mt-5 space-y-4" @submit.prevent="addHolding">
        <div class="grid gap-4 sm:grid-cols-3">
          <label class="block text-sm font-medium text-ink-soft">
            Asset type
            <select
              v-model="form.assetType"
              class="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            >
              <option v-for="type in assetTypes" :key="type" :value="type">
                {{ type }}
              </option>
            </select>
          </label>

          <label class="block text-sm font-medium text-ink-soft">
            Symbol
            <input
              v-model="form.symbol"
              type="text"
              maxlength="32"
              placeholder="BTC"
              class="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </label>

          <label class="block text-sm font-medium text-ink-soft">
            External ID
            <input
              v-model="form.externalId"
              type="text"
              maxlength="255"
              placeholder="bitcoin"
              class="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </label>
        </div>

        <label class="block text-sm font-medium text-ink-soft">
          Name
          <span class="font-normal text-ink-muted">(optional)</span>
          <input
            v-model="form.name"
            type="text"
            maxlength="255"
            placeholder="Defaults to symbol"
            class="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>

        <div class="grid gap-4 sm:grid-cols-3">
          <label class="block text-sm font-medium text-ink-soft">
            Quantity
            <input
              v-model="form.quantity"
              type="text"
              inputmode="decimal"
              placeholder="0.00"
              class="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </label>

          <label class="block text-sm font-medium text-ink-soft">
            Average cost basis
            <input
              v-model="form.avgCostBasis"
              type="text"
              inputmode="decimal"
              placeholder="0.00"
              class="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </label>

          <label class="block text-sm font-medium text-ink-soft">
            Acquisition date
            <input
              v-model="form.acquiredOn"
              type="date"
              class="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </label>
        </div>

        <div class="flex justify-end">
          <button
            type="submit"
            :disabled="creating || !canSubmit"
            class="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-brand-contrast transition hover:bg-brand/90 disabled:opacity-60"
          >
            {{ creating ? 'Adding…' : 'Add holding' }}
          </button>
        </div>
      </form>
    </section>

    <section class="mt-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Holdings
        </h2>
        <span
          v-if="!loading"
          class="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand"
        >
          {{ holdings.length }}
        </span>
      </div>

      <div v-if="loading" class="grid gap-3">
        <div
          v-for="index in 3"
          :key="index"
          class="animate-pulse rounded-2xl border border-line bg-surface-raised p-5"
        >
          <div class="h-4 w-24 rounded bg-line" />
          <div class="mt-3 h-3 w-40 rounded bg-line/80" />
        </div>
      </div>

      <div
        v-else-if="holdings.length === 0"
        class="rounded-2xl border border-dashed border-line-strong bg-surface-raised/70 px-6 py-12 text-center"
      >
        <h3 class="font-display text-xl font-semibold text-ink">
          No holdings yet
        </h3>
        <p class="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
          Add your first position above. Quantity must be greater than zero;
          cost basis can be zero.
        </p>
      </div>

      <ul v-else class="grid gap-3">
        <li
          v-for="holding in holdings"
          :key="holding.id"
          class="rounded-2xl border border-line bg-surface-raised p-5 shadow-sm"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-semibold text-ink">
                  {{ holding.asset.symbol }}
                </p>
                <span
                  class="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-brand"
                >
                  {{ holding.asset.assetType }}
                </span>
              </div>
              <p class="mt-0.5 truncate text-sm text-ink-muted">
                {{ holding.asset.name }}
                · {{ holding.asset.externalId }}
              </p>
            </div>

            <dl class="grid grid-cols-3 gap-4 text-sm sm:text-right">
              <div>
                <dt class="text-xs uppercase tracking-wide text-ink-muted">
                  Qty
                </dt>
                <dd class="mt-0.5 font-medium text-ink">
                  {{ formatDecimal(holding.quantity) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-ink-muted">
                  Cost
                </dt>
                <dd class="mt-0.5 font-medium text-ink">
                  {{ formatDecimal(holding.avgCostBasis) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-ink-muted">
                  Acquired
                </dt>
                <dd class="mt-0.5 font-medium text-ink">
                  {{ formatIsoDate(holding.acquiredOn) }}
                </dd>
              </div>
            </dl>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>
