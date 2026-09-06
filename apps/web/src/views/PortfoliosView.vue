<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

import { ApiError, api } from '../api/client'
import type { Portfolio } from '../api/types'
import { useAuth } from '../auth/session'
import AppAlert from '../components/AppAlert.vue'
import AppHeader from '../components/AppHeader.vue'

const auth = useAuth()

const portfolios = ref<Portfolio[]>([])
const newName = ref('')
const editingId = ref<string | null>(null)
const editName = ref('')
const confirmDeleteId = ref<string | null>(null)
const error = ref('')
const success = ref('')
const loading = ref(true)
const creating = ref(false)
const savingId = ref<string | null>(null)
const deletingId = ref<string | null>(null)
const renameInput = ref<HTMLInputElement | null>(null)

let successTimer: ReturnType<typeof setTimeout> | undefined

function requireToken(): string {
  const token = auth.state.accessToken

  if (!token) {
    throw new Error('Not signed in')
  }

  return token
}

function showSuccess(message: string): void {
  success.value = message
  clearTimeout(successTimer)
  successTimer = setTimeout(() => {
    success.value = ''
  }, 3200)
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function portfolioInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

async function load(): Promise<void> {
  error.value = ''
  loading.value = true

  try {
    portfolios.value = await api.listPortfolios(requireToken())
  } catch (caught: unknown) {
    error.value =
      caught instanceof ApiError ? caught.message : 'Could not load portfolios'
  } finally {
    loading.value = false
  }
}

async function createPortfolio(): Promise<void> {
  const name = newName.value.trim()

  if (!name || creating.value) {
    return
  }

  error.value = ''
  creating.value = true

  try {
    const created = await api.createPortfolio(requireToken(), { name })
    portfolios.value = [...portfolios.value, created]
    newName.value = ''
    showSuccess(`“${created.name}” created.`)
  } catch (caught: unknown) {
    error.value =
      caught instanceof ApiError ? caught.message : 'Could not create portfolio'
  } finally {
    creating.value = false
  }
}

function setRenameInput(
  portfolioId: string,
  element: unknown,
): void {
  if (portfolioId === editingId.value && element instanceof HTMLInputElement) {
    renameInput.value = element
  }
}

async function startRename(portfolio: Portfolio): Promise<void> {
  confirmDeleteId.value = null
  editingId.value = portfolio.id
  editName.value = portfolio.name
  error.value = ''
  await nextTick()
  renameInput.value?.focus()
  renameInput.value?.select()
}

function cancelRename(): void {
  editingId.value = null
  editName.value = ''
}

async function saveRename(portfolioId: string): Promise<void> {
  const name = editName.value.trim()

  if (!name || savingId.value) {
    return
  }

  error.value = ''
  savingId.value = portfolioId

  try {
    const updated = await api.updatePortfolio(requireToken(), portfolioId, {
      name,
    })
    portfolios.value = portfolios.value.map((item) =>
      item.id === portfolioId ? updated : item,
    )
    cancelRename()
    showSuccess('Portfolio renamed.')
  } catch (caught: unknown) {
    error.value =
      caught instanceof ApiError ? caught.message : 'Could not rename portfolio'
  } finally {
    savingId.value = null
  }
}

function requestDelete(portfolioId: string): void {
  editingId.value = null
  confirmDeleteId.value = portfolioId
  error.value = ''
}

function cancelDelete(): void {
  confirmDeleteId.value = null
}

async function confirmDelete(portfolio: Portfolio): Promise<void> {
  if (deletingId.value) {
    return
  }

  error.value = ''
  deletingId.value = portfolio.id

  try {
    await api.deletePortfolio(requireToken(), portfolio.id)
    portfolios.value = portfolios.value.filter(
      (item) => item.id !== portfolio.id,
    )
    confirmDeleteId.value = null
    showSuccess(`“${portfolio.name}” deleted.`)
  } catch (caught: unknown) {
    error.value =
      caught instanceof ApiError ? caught.message : 'Could not delete portfolio'
  } finally {
    deletingId.value = null
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <main class="mx-auto max-w-2xl px-4 py-8 sm:py-10">
    <AppHeader
      title="Portfolios"
      subtitle="Organize holdings into separate buckets."
    />

    <div v-if="success" class="mb-4 animate-fade-in">
      <AppAlert variant="success">{{ success }}</AppAlert>
    </div>

    <div v-if="error" class="mb-4">
      <AppAlert variant="error">{{ error }}</AppAlert>
    </div>

    <section
      class="rounded-2xl border border-line bg-surface-raised p-5 shadow-sm sm:p-6"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label class="block min-w-0 flex-1 text-sm font-medium text-ink-soft">
          New portfolio
          <input
            v-model="newName"
            type="text"
            maxlength="120"
            placeholder="e.g. Long-term growth"
            class="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15"
            @keydown.enter.prevent="createPortfolio"
          />
        </label>
        <button
          type="button"
          :disabled="creating || !newName.trim()"
          class="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-brand-contrast transition hover:bg-brand/90 disabled:opacity-60 sm:mb-0.5"
          @click="createPortfolio"
        >
          {{ creating ? 'Creating…' : 'Create portfolio' }}
        </button>
      </div>
    </section>

    <section class="mt-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Your portfolios
        </h2>
        <span
          v-if="!loading"
          class="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand"
        >
          {{ portfolios.length }}
        </span>
      </div>

      <div v-if="loading" class="grid gap-3">
        <div
          v-for="index in 3"
          :key="index"
          class="animate-pulse rounded-2xl border border-line bg-surface-raised p-5"
        >
          <div class="flex items-center gap-4">
            <div class="h-12 w-12 rounded-2xl bg-line" />
            <div class="flex-1 space-y-2">
              <div class="h-4 w-32 rounded bg-line" />
              <div class="h-3 w-24 rounded bg-line/80" />
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="portfolios.length === 0"
        class="rounded-2xl border border-dashed border-line-strong bg-surface-raised/70 px-6 py-12 text-center"
      >
        <div
          class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-7 w-7 text-brand"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 7.5A2.5 2.5 0 0 1 5.5 5h5.879a2.5 2.5 0 0 1 1.768.732l1.414 1.414A2.5 2.5 0 0 0 16.121 8H18.5A2.5 2.5 0 0 1 21 10.5V18a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18V7.5Z"
            />
          </svg>
        </div>
        <h3 class="mt-4 font-display text-xl font-semibold text-ink">
          No portfolios yet
        </h3>
        <p class="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
          Create your first portfolio above. New accounts start with a
          <span class="font-medium text-ink-soft">Default</span> portfolio
          automatically.
        </p>
      </div>

      <ul v-else class="grid gap-3">
        <li
          v-for="portfolio in portfolios"
          :key="portfolio.id"
          class="rounded-2xl border border-line bg-surface-raised p-5 shadow-sm transition hover:border-brand/20 hover:shadow-md"
        >
          <div
            v-if="confirmDeleteId === portfolio.id"
            class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p class="font-medium text-ink">Delete “{{ portfolio.name }}”?</p>
              <p class="mt-1 text-sm text-ink-muted">
                This hides the portfolio. You can create a new one anytime.
              </p>
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-xl border border-line-strong px-4 py-2 text-sm text-ink-soft transition hover:text-ink"
                :disabled="deletingId === portfolio.id"
                @click="cancelDelete"
              >
                Cancel
              </button>
              <button
                type="button"
                class="rounded-xl bg-danger px-4 py-2 text-sm font-medium text-white transition hover:bg-danger/90 disabled:opacity-60"
                :disabled="deletingId === portfolio.id"
                @click="confirmDelete(portfolio)"
              >
                {{
                  deletingId === portfolio.id ? 'Deleting…' : 'Delete portfolio'
                }}
              </button>
            </div>
          </div>

          <div
            v-else-if="editingId === portfolio.id"
            class="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <input
              :ref="(element) => setRenameInput(portfolio.id, element)"
              v-model="editName"
              type="text"
              maxlength="120"
              class="min-w-0 flex-1 rounded-xl border border-brand/40 bg-surface px-3.5 py-2.5 text-sm text-ink outline-none ring-2 ring-brand/15"
              @keydown.enter.prevent="saveRename(portfolio.id)"
              @keydown.escape.prevent="cancelRename"
            />
            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast disabled:opacity-60"
                :disabled="savingId === portfolio.id || !editName.trim()"
                @click="saveRename(portfolio.id)"
              >
                {{ savingId === portfolio.id ? 'Saving…' : 'Save' }}
              </button>
              <button
                type="button"
                class="rounded-xl border border-line-strong px-4 py-2 text-sm text-ink-soft"
                @click="cancelRename"
              >
                Cancel
              </button>
            </div>
          </div>

          <div
            v-else
            class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="flex min-w-0 items-center gap-4">
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 font-display text-lg font-semibold text-brand"
              >
                {{ portfolioInitial(portfolio.name) }}
              </div>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="truncate text-base font-semibold text-ink">
                    {{ portfolio.name }}
                  </p>
                  <span
                    v-if="portfolio.name === 'Default'"
                    class="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-brand"
                  >
                    Starter
                  </span>
                </div>
                <p class="mt-0.5 text-sm text-ink-muted">
                  Private · Updated {{ formatDate(portfolio.updatedAt) }}
                </p>
              </div>
            </div>

            <div class="flex gap-2 sm:shrink-0">
              <button
                type="button"
                class="rounded-xl border border-line-strong px-4 py-2 text-sm text-ink-soft transition hover:border-brand/30 hover:text-ink"
                @click="startRename(portfolio)"
              >
                Rename
              </button>
              <button
                type="button"
                class="rounded-xl border border-danger/20 px-4 py-2 text-sm text-danger transition hover:border-danger/40 hover:bg-danger/5"
                @click="requestDelete(portfolio.id)"
              >
                Delete
              </button>
            </div>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>
