<script setup lang="ts">
import { HOSPITAL_NAME } from '../../domain/branding'
import PublicNewsCard from '../../components/public/NewsCard.vue'
import PublicSectionHeading from '../../components/public/SectionHeading.vue'
import PublicStatusPanel from '../../components/public/StatusPanel.vue'

definePageMeta({ layout: 'public' })
const { pending, error, refresh, article, related } = usePublicArticle()
useSeoMeta({ title: () => article.value ? article.value.title + ' · ' + HOSPITAL_NAME : 'Berita · ' + HOSPITAL_NAME, description: () => article.value?.summary || article.value?.content.slice(0, 155), robots: 'index, follow' })
</script>
<template>
  <div class="public-container public-section">
    <NuxtLink to="/berita" class="public-text-link">Kembali ke berita</NuxtLink>
    <PublicStatusPanel v-if="pending && !article" state="loading" title="Memuat berita…" class="mt-8" />
    <PublicStatusPanel
      v-else-if="error"
      state="error"
      title="Berita belum dapat dimuat."
      action-label="Coba lagi"
      class="mt-8"
      @action="refresh()"
    />
    <template v-else-if="article">
      <article class="public-article mx-auto pt-9 sm:pt-12">
        <header class="border-b border-slate-100 pb-8">
          <div class="flex flex-wrap items-center gap-3">
            <span class="public-pill public-pill-teal">Berita RS</span>
            <time :datetime="article.date" class="text-xs text-slate-600">{{ article.dateLabel }}</time>
          </div>
          <h1 class="public-page-title mt-6">{{ article.title }}</h1>
          <p class="mt-5 text-xs font-medium text-brand-700">{{ HOSPITAL_NAME }}</p>
          <p v-if="article.summary.trim()" class="mt-7 text-lg leading-8 text-slate-600">{{ article.summary }}</p>
        </header>
        <div class="public-article-body py-9 sm:py-12">
          <p v-for="(paragraph, index) in article.paragraphs" :key="index" class="whitespace-pre-line">{{ paragraph }}</p>
        </div>
      </article>
      <section v-if="related.length" class="mt-10 border-t border-slate-100 pt-10">
        <PublicSectionHeading title="Berita lainnya" link="/berita" link-label="Semua berita" />
        <div class="grid gap-5 md:grid-cols-2">
          <PublicNewsCard v-for="item in related" :key="item.id" :item="item" />
        </div>
      </section>
    </template>
    <PublicStatusPanel v-else state="empty" title="Berita tidak ditemukan." class="mt-8" />
  </div>
</template>
