<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";

import { ApiError, googleAuthUrl } from "../api/client";
import { useAuth } from "../auth/session";

const router = useRouter();
const auth = useAuth();

const mode = ref<"login" | "register">("login");
const email = ref("");
const password = ref("");
const error = ref("");
const pending = ref(false);

async function submit(): Promise<void> {
  error.value = "";
  pending.value = true;

  try {
    if (mode.value === "login") {
      await auth.login(email.value, password.value);
    } else {
      await auth.register(email.value, password.value);
    }

    await router.replace("/portfolios");
  } catch (caught: unknown) {
    error.value =
      caught instanceof ApiError ? caught.message : "Something went wrong";
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <main class="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4">
    <section
      class="rounded-2xl border border-line bg-surface-raised p-8 shadow-sm"
    >
      <p class="font-display text-sm font-medium text-ink-muted">
        Market Intelligence
      </p>
      <h1
        class="mt-1 font-display text-2xl font-semibold tracking-tight text-ink"
      >
        {{ mode === "login" ? "Sign in" : "Create an account" }}
      </h1>
      <p class="mt-2 text-sm text-ink-muted">
        Email and password, or continue with Google.
      </p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <label class="block text-sm font-medium text-ink-soft">
          Email
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="mt-1 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>
        <label class="block text-sm font-medium text-ink-soft">
          Password
          <input
            v-model="password"
            type="password"
            required
            :minlength="mode === 'register' ? 8 : 1"
            autocomplete="current-password"
            class="mt-1 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>

        <p v-if="error" class="text-sm text-danger">{{ error }}</p>

        <button
          type="submit"
          :disabled="pending"
          class="w-full rounded-xl bg-brand px-3 py-2.5 text-sm font-medium text-brand-contrast transition hover:bg-brand/90 disabled:opacity-60"
        >
          {{
            pending ? "Please wait…" : mode === "login" ? "Sign in" : "Register"
          }}
        </button>
      </form>

      <a
        :href="googleAuthUrl()"
        class="mt-3 flex w-full items-center justify-center rounded-xl border border-line-strong px-3 py-2.5 text-sm font-medium text-ink-soft transition hover:border-brand/30 hover:text-ink"
      >
        Continue with Google
      </a>

      <button
        type="button"
        class="mt-4 w-full text-sm text-ink-muted underline"
        @click="mode = mode === 'login' ? 'register' : 'login'"
      >
        {{
          mode === "login"
            ? "Need an account? Register"
            : "Already have an account? Sign in"
        }}
      </button>
    </section>
  </main>
</template>
