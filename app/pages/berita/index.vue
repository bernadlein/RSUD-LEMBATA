<script setup lang="ts">
import { Search } from '@lucide/vue'
import { prettyDate } from '../../domain/calendar'
definePageMeta({ layout: 'public' })
const site = usePublicHospital(), query = ref('')
const rows = computed(() => [...(site.hospital.value?.news ?? [])].filter(n => (n.title + ' ' + n.summary).toLowerCase().includes(query.value.trim().toLowerCase())).sort((a, b) => b.date.localeCompare(a.date)))
useSeoMeta({ title: () => 'Berita · ' + (site.hospital.value?.name || 'Rumah Sakit'), robots: 'index, follow' })
</script>
<template>
  <div class="mx-auto max-w-7xl px-5 py-9 lg:px-8"><section class="app-hero rounded-[1.75rem] p-7 sm:p-9"><p class="eyebrow text-brand-700">INFORMASI TERBARU</p><h1 class="mt-4 text-3xl font-semibold tracking-tight">Berita dan pengumuman RS</h1><p class="mt-4 text-sm leading-relaxed text-slate-600">Informasi pelayanan dan kegiatan yang diterbitkan rumah sakit.</p></section><div class="relative mt-6 max-w-xl"><Search class="absolute top-3 left-3 text-slate-400" :size="17" /><input v-model="query" class="field pl-10" aria-label="Cari berita" placeholder="Cari berita atau pengumuman" /></div><p v-if="site.pending.value" class="panel mt-6 p-7 text-sm text-slate-500">Memuat berita…</p><section v-else-if="site.error.value" class="panel mt-6 p-7"><p class="text-sm text-slate-600">Berita belum dapat dimuat.</p><button class="btn btn-secondary mt-4" @click="site.refresh()">Coba lagi</button></section><div v-else-if="rows.length" class="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3"><article v-for="item in rows" :key="item.id" class="panel flex flex-col p-6"><p class="text-xs font-medium text-brand-700">{{ prettyDate(item.date) }}</p><h2 class="mt-4 text-xl font-semibold leading-snug">{{ item.title }}</h2><p class="mt-4 flex-1 text-sm leading-relaxed text-slate-600">{{ item.summary || item.content.slice(0, 180) }}</p><NuxtLink :to="'/berita/' + item.id" class="mt-6 text-sm font-semibold text-brand-700">Baca berita</NuxtLink></article></div><p v-else class="panel mt-6 p-8 text-sm text-slate-600">Belum ada berita yang sesuai pencarian.</p></div>
</template>
