<script setup lang="ts">
defineProps<{ state: 'loading' | 'error' | 'empty'; title: string; description?: string; actionLabel?: string }>()
defineEmits<{ action: [] }>()
</script>
<template>
  <section
    class="public-status"
    :class="{ 'is-error': state === 'error' }"
    role="status"
    aria-live="polite"
    :aria-busy="state === 'loading'"
  >
    <div v-if="state === 'loading'" class="public-loading-mark" aria-hidden="true"></div>
    <h2 class="text-base font-semibold">{{ title }}</h2>
    <p v-if="description" class="mt-3 text-sm leading-7 text-slate-600">{{ description }}</p>
    <button
      v-if="actionLabel && state !== 'loading'"
      type="button"
      class="public-button public-button-outline mt-5"
      @click="$emit('action')"
    >
      {{ actionLabel }}
    </button>
  </section>
</template>
