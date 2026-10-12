<script setup lang="ts">
import { Search } from '@lucide/vue'
import { HOSPITAL_NAME } from '../../domain/branding'
import PublicPageHero from '../../components/public/PageHero.vue'
import PublicNewsCard from '../../components/public/NewsCard.vue'
import PublicStatusPanel from '../../components/public/StatusPanel.vue'

definePageMeta({ layout: 'public' })
const { pending, error, refresh, query, results, featured, remaining } = usePublicNews()
useSeoMeta({ title: 'Berita & pengumuman · ' + HOSPITAL_NAME, description: 'Berita dan pengumuman RSUD LEWOLEBA.', robots: 'index, follow' })
</script>
<template>
  <PublicPageHero eyebrow="Informasi rumah sakit" title="Berita & pengumuman" />
  <div class="public-container public-section">
    <div class="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div class="w-full max-w-xl">
        <label for="public-news-search" class="label">Cari berita</label>
        <div class="relative">
          <Search :size="17" class="pointer-events-none absolute top-4 left-3.5 text-slate-600" aria-hidden="true" />
          <input id="public-news-search" v-model="query" type="search" class="field min-h-12 pl-10" autocomplete="off" />
        </div>
      </div>
      <p v-if="!pending && !error && results.length" class="text-xs text-slate-600" role="status">{{ results.length }} berita</p>
    </div>
    <PublicStatusPanel v-if="pending && !results.length" state="loading" title="Memuat berita…" />
    <PublicStatusPanel
      v-else-if="error"
      state="error"
      title="Berita belum dapat dimuat."
      action-label="Coba lagi"
      @action="refresh()"
    />
    <template v-else-if="results.length">
      <PublicNewsCard v-if="featured" :item="featured" heading="h2" featured class="mb-6" />
      <div v-if="remaining.length" class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <PublicNewsCard v-for="item in remaining" :key="item.id" :item="item" heading="h2" />
      </div>
    </template>
    <PublicStatusPanel
      v-else
      state="empty"
      :title="query.trim() ? 'Tidak ada hasil pencarian.' : 'Belum ada berita yang diterbitkan.'"
      :action-label="query.trim() ? 'Hapus pencarian' : undefined"
      @action="query = ''"
    />
  </div>
</template>
