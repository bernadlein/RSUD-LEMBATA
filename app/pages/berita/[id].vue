<script setup lang="ts">
import { HOSPITAL_NAME } from '../../domain/branding'
import { prettyDate } from '../../domain/calendar'
definePageMeta({ layout: 'public' })
const site = usePublicHospital(), route = useRoute()
const article = computed(() => site.hospital.value?.news.find(n => n.id === route.params.id))
useSeoMeta({ title: () => article.value?.title || 'Berita · ' + HOSPITAL_NAME, description: () => article.value?.summary, robots: 'index, follow' })
</script>
<template>
  <div class="mx-auto max-w-3xl px-5 py-10"><NuxtLink to="/berita" class="text-sm font-semibold text-brand-700">Kembali ke berita</NuxtLink><p v-if="site.pending.value" class="panel mt-6 p-7 text-sm text-slate-600">Memuat berita…</p><section v-else-if="article" class="mt-7"><p class="text-sm text-brand-700">{{ prettyDate(article.date) }} · {{ site.hospital.value?.name }}</p><h1 class="mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{{ article.title }}</h1><p v-if="article.summary" class="mt-6 border-l-4 border-brand-400 pl-5 text-lg leading-relaxed text-slate-600">{{ article.summary }}</p><div class="mt-8 whitespace-pre-line text-base leading-8 text-slate-700">{{ article.content }}</div></section><section v-else class="panel mt-6 p-8"><h1 class="text-xl font-semibold">Berita belum tersedia</h1><p class="mt-3 text-sm text-slate-600">Berita tidak tersedia.</p><button v-if="site.error.value" class="btn btn-secondary mt-4" @click="site.refresh()">Coba lagi</button></section></div>
</template>
