<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { ApiError } from '../api/client'
import { useAuth } from '../auth/session'
import AppAlert from '../components/AppAlert.vue'
import AppHeader from '../components/AppHeader.vue'

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
</script>

<template>
  <main class="mx-auto max-w-2xl px-4 py-8 sm:py-10">
    <AppHeader
      title="Profile"
      subtitle="Manage how you appear across the app."
    />

    <section
      class="rounded-2xl border border-line bg-surface-raised p-5 shadow-sm sm:p-6"
    >
      <div v-if="auth.state.user?.avatarUrl" class="mb-5">
        <img
          :src="auth.state.user.avatarUrl"
          alt=""
          class="h-16 w-16 rounded-full object-cover ring-2 ring-line"
        />
      </div>

      <form class="space-y-5" @submit.prevent="save">
        <label class="block text-sm font-medium text-ink-soft">
          Display name
          <input
            v-model="displayName"
            type="text"
            maxlength="120"
            class="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>

        <label class="block text-sm font-medium text-ink-soft">
          Avatar URL
          <input
            v-model="avatarUrl"
            type="url"
            maxlength="2048"
            placeholder="https://"
            class="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>

        <label class="block text-sm font-medium text-ink-soft">
          Default currency
          <select
            v-model="defaultCurrency"
            class="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>

        <div v-if="error" class="pt-1">
          <AppAlert variant="error">{{ error }}</AppAlert>
        </div>
        <div v-else-if="saved" class="pt-1">
          <AppAlert variant="success">Profile saved.</AppAlert>
        </div>

        <button
          type="submit"
          :disabled="pending"
          class="rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-brand-contrast transition hover:bg-brand/90 disabled:opacity-60"
        >
          {{ pending ? 'Saving…' : 'Save profile' }}
        </button>
      </form>
    </section>
  </main>
</template>
