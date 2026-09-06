<script setup lang="ts">
defineProps<{
  variant: 'error' | 'success' | 'info'
}>()
</script>

<template>
  <div
    class="rounded-lg border px-4 py-3 text-sm"
    :class="{
      'border-danger/20 bg-danger/5 text-danger': variant === 'error',
      'border-success/20 bg-success/5 text-success': variant === 'success',
      'border-line bg-surface text-ink-muted': variant === 'info',
    }"
    role="alert"
  >
    <slot />
  </div>
</template>
