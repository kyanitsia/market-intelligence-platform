<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { ApiError, api } from '../api/client'
import type { AppNotification, CatalogAsset, PriceAlert } from '../api/types'
import { useAuth } from '../auth/session'
import AppAlert from '../components/AppAlert.vue'
import AppHeader from '../components/AppHeader.vue'

const auth = useAuth()
const alerts = ref<PriceAlert[]>([])
const notifications = ref<AppNotification[]>([])
const results = ref<CatalogAsset[]>([])
const selected = ref<CatalogAsset | null>(null)
const query = ref('')
const operator = ref<'GTE' | 'LTE'>('GTE')
const targetPrice = ref('')
const error = ref('')
const loading = ref(true)

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
    const accessToken = token()
    const [loadedAlerts, loadedNotifications] = await Promise.all([
      api.listPriceAlerts(accessToken),
      api.listNotifications(accessToken),
    ])
    alerts.value = loadedAlerts
    notifications.value = loadedNotifications
  } catch (caught: unknown) {
    error.value = caught instanceof ApiError ? caught.message : 'Could not load alerts'
  } finally {
    loading.value = false
  }
}

async function search(): Promise<void> {
  if (query.value.trim().length < 2) {
    return
  }

  error.value = ''

  try {
    results.value = await api.searchAssets(token(), query.value.trim())
  } catch (caught: unknown) {
    error.value = caught instanceof ApiError ? caught.message : 'Search failed'
  }
}

function choose(asset: CatalogAsset): void {
  selected.value = asset
  results.value = []
  query.value = asset.symbol
}

async function create(): Promise<void> {
  if (!selected.value || !/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(targetPrice.value.trim())) {
    return
  }

  error.value = ''

  try {
    await api.createPriceAlert(token(), {
      assetId: selected.value.id,
      operator: operator.value,
      targetPrice: targetPrice.value.trim(),
    })
    selected.value = null
    query.value = ''
    targetPrice.value = ''
    await load()
  } catch (caught: unknown) {
    error.value = caught instanceof ApiError ? caught.message : 'Could not create the alert'
  }
}

async function toggle(alert: PriceAlert): Promise<void> {
  error.value = ''

  try {
    await api.updatePriceAlert(token(), alert.id, { active: !alert.active })
    await load()
  } catch (caught: unknown) {
    error.value = caught instanceof ApiError ? caught.message : 'Could not update the alert'
  }
}

async function remove(alert: PriceAlert): Promise<void> {
  error.value = ''

  try {
    await api.deletePriceAlert(token(), alert.id)
    await load()
  } catch (caught: unknown) {
    error.value = caught instanceof ApiError ? caught.message : 'Could not delete the alert'
  }
}

async function markRead(notification: AppNotification): Promise<void> {
  if (notification.readAt) {
    return
  }

  try {
    await api.markNotificationRead(token(), notification.id)
    await load()
  } catch (caught: unknown) {
    error.value = caught instanceof ApiError ? caught.message : 'Could not update the notification'
  }
}

function label(value: 'GTE' | 'LTE'): string {
  return value === 'GTE' ? 'at or above' : 'at or below'
}

function money(value: string): string {
  const numeric = Number(value)

  return Number.isFinite(numeric)
    ? new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      }).format(numeric)
    : value
}

onMounted(() => {
  void load()
})
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-8 sm:py-10">
    <AppHeader
      title="Alerts"
      subtitle="A price alert fires once, then waits an hour before it can fire again."
    />

    <AppAlert v-if="error" class="mb-4" variant="error">{{ error }}</AppAlert>

    <form class="mb-8 space-y-3 rounded-2xl border border-line bg-surface-raised p-5" @submit.prevent="create">
      <div class="flex gap-2">
        <input
          v-model="query"
          type="search"
          placeholder="Find an asset"
          class="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
        <button type="button" class="rounded-xl border border-line-strong px-4 text-sm" @click="search">
          Search
        </button>
      </div>
      <ul v-if="results.length" class="grid gap-1">
        <li v-for="asset in results" :key="asset.id">
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm hover:border-brand/40"
            @click="choose(asset)"
          >
            <span>
              <span class="font-semibold text-ink">{{ asset.symbol }}</span>
              <span class="ml-2 text-ink-muted">{{ asset.name }}</span>
            </span>
            <span class="text-[11px] font-medium uppercase tracking-wide text-brand">
              {{ asset.assetType }}
            </span>
          </button>
        </li>
      </ul>
      <p
        v-if="selected"
        class="inline-flex w-fit rounded-full bg-brand/10 px-3 py-1 text-sm font-medium text-brand"
      >
        {{ selected.symbol }}
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        <select v-model="operator" class="rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm">
          <option value="GTE">At or above</option>
          <option value="LTE">At or below</option>
        </select>
        <input
          v-model="targetPrice"
          inputmode="decimal"
          placeholder="Target price"
          class="rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm"
        />
      </div>
      <button
        type="submit"
        class="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-contrast disabled:opacity-60"
        :disabled="!selected"
      >
        Create alert
      </button>
    </form>

    <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Rules</h2>
    <p v-if="loading" class="text-sm text-ink-muted">Loading…</p>
    <ul v-else class="mb-8 grid gap-3">
      <li v-if="alerts.length === 0" class="text-sm text-ink-muted">No price alerts yet.</li>
      <li
        v-for="alert in alerts"
        :key="alert.id"
        class="flex flex-col gap-3 rounded-2xl border border-line bg-surface-raised p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <router-link :to="`/assets/${alert.asset.id}`" class="font-semibold text-ink hover:text-brand">
              {{ alert.asset.symbol }}
            </router-link>
            <span
              class="rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
              :class="alert.active ? 'bg-success/10 text-success' : 'bg-line text-ink-muted'"
            >
              {{ alert.active ? 'Active' : 'Paused' }}
            </span>
          </div>
          <p class="mt-1 text-sm text-ink-muted">
            {{ label(alert.operator) }} {{ money(alert.targetPrice) }}
          </p>
        </div>
        <div class="flex gap-2">
          <button type="button" class="rounded-lg border border-line-strong px-3 py-1.5 text-sm" @click="toggle(alert)">
            {{ alert.active ? 'Pause' : 'Resume' }}
          </button>
          <button type="button" class="rounded-lg border border-line-strong px-3 py-1.5 text-sm" @click="remove(alert)">
            Delete
          </button>
        </div>
      </li>
    </ul>

    <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Notifications</h2>
    <ul class="grid gap-2">
      <li v-if="!loading && notifications.length === 0" class="text-sm text-ink-muted">
        Nothing has fired yet.
      </li>
      <li
        v-for="notification in notifications"
        :key="notification.id"
        class="rounded-xl border bg-surface-raised px-4 py-3 text-sm shadow-sm"
        :class="notification.readAt ? 'border-line text-ink-muted' : 'border-brand/30 text-ink'"
      >
        <button type="button" class="flex w-full items-start gap-3 text-left" @click="markRead(notification)">
          <span
            class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            :class="notification.readAt ? 'bg-line-strong' : 'bg-brand'"
          />
          <span>
            {{ notification.payload.symbol }} is {{ money(notification.payload.price) }},
            {{ label(notification.payload.operator) }} {{ money(notification.payload.targetPrice) }}.
          </span>
        </button>
      </li>
    </ul>
  </main>
</template>
