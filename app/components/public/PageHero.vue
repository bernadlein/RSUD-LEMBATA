<script setup lang="ts">
defineProps<{ eyebrow: string; title: string; description?: string; meta?: string }>()
</script>
<template>
  <section class="public-page-hero">
    <div class="public-container py-11 sm:py-14 lg:py-17">
      <p class="public-eyebrow">{{ eyebrow }}</p>
      <div class="mt-4 flex flex-wrap items-end justify-between gap-6">
        <div class="max-w-3xl">
          <h1 class="public-page-title">{{ title }}</h1>
          <p v-if="description" class="mt-5 max-w-2xl text-base leading-8 text-slate-600">{{ description }}</p>
        </div>
        <span v-if="meta" class="public-pill public-pill-lime">{{ meta }}</span>
        <slot />
      </div>
    </div>
  </section>
</template>
