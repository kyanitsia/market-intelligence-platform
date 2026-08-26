<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError } from '../api/client'
import { useAuth } from '../auth/session'

const router = useRouter()
const auth = useAuth()

const displayName = ref('')
const avatarUrl = ref('')
const defaultCurrency = ref<'USD' | 'EUR'>('USD')
const error = ref('')
const saved = ref(false)
const pending = ref(false)

function fillForm(): void {
  const user = auth.state.user

  displayName.value = user?.displayName ?? ''
  avatarUrl.value = user?.avatarUrl ?? ''
  defaultCurrency.value = user?.defaultCurrency ?? 'USD'
}

onMounted(() => {
  fillForm()
})

async function save(): Promise<void> {
  error.value = ''
  saved.value = false
  pending.value = true

  try {
    await auth.saveProfile({
      displayName: displayName.value,
      avatarUrl: avatarUrl.value,
      defaultCurrency: defaultCurrency.value,
    })
    saved.value = true
  } catch (caught: unknown) {
    error.value =
      caught instanceof ApiError ? caught.message : 'Could not save profile'
  } finally {
    pending.value = false
  }
}

async function logout(): Promise<void> {
  await auth.logout()
  await router.replace('/login')
}
</script>

<template>
  <main class="mx-auto max-w-xl px-4 py-10">
    <header class="mb-6 flex items-start justify-between gap-4">
      <div>
        <p class="text-sm font-medium text-ink-muted">Signed in</p>
        <h1 class="font-display text-2xl font-semibold tracking-tight text-ink">
          Profile
        </h1>
        <p class="mt-1 text-sm text-ink-muted">{{ auth.state.user?.email }}</p>
      </div>
      <button
        type="button"
        class="rounded-lg border border-line-strong px-3 py-2 text-sm text-ink-soft"
        @click="logout"
      >
        Log out
      </button>
    </header>

    <section
      class="rounded-2xl border border-line bg-surface-raised p-6 shadow-sm"
    >
      <div v-if="auth.state.user?.avatarUrl" class="mb-4">
        <img
          :src="auth.state.user.avatarUrl"
          alt=""
          class="h-16 w-16 rounded-full object-cover"
        />
      </div>

      <form class="space-y-4" @submit.prevent="save">
        <label class="block text-sm font-medium text-ink-soft">
          Display name
          <input
            v-model="displayName"
            type="text"
            maxlength="120"
            class="mt-1 w-full rounded-lg border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
        </label>

        <label class="block text-sm font-medium text-ink-soft">
          Avatar URL
          <input
            v-model="avatarUrl"
            type="url"
            maxlength="2048"
            placeholder="https://"
            class="mt-1 w-full rounded-lg border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
        </label>

        <label class="block text-sm font-medium text-ink-soft">
          Default currency
          <select
            v-model="defaultCurrency"
            class="mt-1 w-full rounded-lg border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>

        <p v-if="error" class="text-sm text-danger">{{ error }}</p>
        <p v-else-if="saved" class="text-sm text-success">Profile saved.</p>

        <button
          type="submit"
          :disabled="pending"
          class="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-contrast disabled:opacity-60"
        >
          {{ pending ? 'Saving…' : 'Save profile' }}
        </button>
      </form>
    </section>
  </main>
</template>
