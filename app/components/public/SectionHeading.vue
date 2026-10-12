<script setup lang="ts">
defineProps<{ title: string; eyebrow?: string; description?: string; link?: string; linkLabel?: string }>()
</script>
<template>
  <div class="mb-7 flex flex-wrap items-end justify-between gap-5 sm:mb-9">
    <div class="max-w-2xl">
      <p v-if="eyebrow" class="public-eyebrow mb-3">{{ eyebrow }}</p>
      <h2 class="public-section-title">{{ title }}</h2>
      <p v-if="description" class="mt-3 text-sm leading-7 text-slate-600">{{ description }}</p>
    </div>
    <NuxtLink v-if="link && linkLabel" :to="link" class="public-text-link">{{ linkLabel }}</NuxtLink>
    <slot />
  </div>
</template>
