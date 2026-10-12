<script setup lang="ts">
import type { PublicNewsItem } from '../../domain/public-portal'
withDefaults(defineProps<{ item: PublicNewsItem; featured?: boolean; heading?: 'h2' | 'h3' }>(), { heading: 'h3' })
</script>
<template>
  <article class="public-card public-news-card" :class="{ 'is-featured': featured }">
    <div class="flex flex-wrap items-center gap-3">
      <span class="public-pill" :class="featured ? 'public-pill-lime' : 'public-pill-teal'">Berita RS</span>
      <time :datetime="item.date" class="text-xs text-slate-600">{{ item.dateLabel }}</time>
    </div>
    <component
      :is="heading"
      class="mt-6 font-semibold tracking-tight"
      :class="featured ? 'text-2xl leading-snug sm:text-3xl' : 'text-xl leading-snug'"
    >
      <NuxtLink :to="item.url" class="hover:text-brand-700">{{ item.title }}</NuxtLink>
    </component>
    <p class="mt-4 flex-1 text-sm leading-7 text-slate-600">{{ item.summary }}</p>
    <NuxtLink :to="item.url" class="public-text-link mt-6 self-start" :aria-label="'Baca berita: ' + item.title">
      Baca selengkapnya
    </NuxtLink>
  </article>
</template>
