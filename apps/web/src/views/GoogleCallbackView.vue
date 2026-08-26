<template>
  <main class="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4">
    <section
      class="rounded-2xl border border-line bg-surface-raised p-8 text-center shadow-sm"
    >
      <h1 class="font-display text-xl font-semibold text-ink">
        Google sign-in did not complete
      </h1>
      <p class="mt-2 text-sm text-ink-muted">
        The API did not set a session cookie. Check Google OAuth env vars and
        try again.
      </p>
      <router-link
        to="/login"
        class="mt-4 inline-block text-sm font-medium text-ink underline"
      >
        Back to sign in
      </router-link>
    </section>
  </main>
</template>
