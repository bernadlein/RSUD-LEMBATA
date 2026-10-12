<script setup lang="ts">
import { CalendarDays, Newspaper, UsersRound, Phone, MapPin } from '@lucide/vue'
import { prettyDate, monthLabel } from '../domain/calendar'
import { HOSPITAL_NAME } from '../domain/branding'
definePageMeta({ layout: 'public' })
const site = usePublicHospital()
const news = computed(() => [...(site.hospital.value?.news ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3))
useSeoMeta({
  title: HOSPITAL_NAME,
  description: () => site.hospital.value?.about.slice(0, 155) || 'Jadwal dokter dan berita RSUD LEWOLEBA.',
  robots: 'index, follow',
})
</script>
<template>
  <div class="mx-auto max-w-7xl px-5 pt-7 lg:px-8 lg:pt-10">
    <section class="app-hero grid items-center gap-8 rounded-[2rem] p-7 sm:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:p-12">
      <div>
        <h1 class="max-w-xl text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">{{ HOSPITAL_NAME }}</h1>
        <p v-if="site.hospital.value?.about" class="mt-5 max-w-xl whitespace-pre-line text-base leading-relaxed text-slate-700">{{ site.hospital.value.about }}</p>
      </div>
      <div class="grid gap-4">
        <NuxtLink to="/jadwal-dokter" class="flex items-center gap-4 rounded-2xl border border-brand-100 bg-white p-5 hover:border-brand-300">
          <span class="rounded-xl bg-brand-50 p-3 text-brand-700"><CalendarDays :size="24" /></span>
          <div><h2 class="text-lg font-semibold">Jadwal dokter</h2><p v-if="site.hospital.value?.schedule.month" class="mt-1 text-sm text-slate-600">{{ monthLabel(site.hospital.value.schedule.month) }}</p></div>
        </NuxtLink>
        <NuxtLink to="/berita" class="flex items-center gap-4 rounded-2xl border border-brand-100 bg-white p-5 hover:border-brand-300">
          <span class="rounded-xl bg-[#f3f9df] p-3 text-brand-800"><Newspaper :size="24" /></span><h2 class="text-lg font-semibold">Berita RS</h2>
        </NuxtLink>
      </div>
    </section>
    <section v-if="site.error.value" class="panel mt-7 p-5" role="status"><p class="text-sm text-slate-700">Informasi belum dapat dimuat.</p><button class="btn btn-secondary mt-3" @click="site.refresh()">Muat ulang</button></section>
    <section v-if="site.hospital.value?.services.length" class="mt-10">
      <h2 class="text-2xl font-semibold tracking-tight">Layanan</h2>
      <div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><article v-for="service in site.hospital.value.services" :key="service" class="panel flex items-center gap-3 p-5"><span class="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500"></span><h3 class="text-sm font-medium">{{ service }}</h3></article></div>
    </section>
    <section v-if="site.hospital.value?.doctors.length" class="mt-10">
      <div class="flex items-center gap-3"><UsersRound :size="22" class="text-brand-700" /><h2 class="text-2xl font-semibold tracking-tight">Dokter</h2></div>
      <div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article v-for="doctor in site.hospital.value.doctors" :key="doctor.id" class="panel flex items-center gap-4 p-5">
          <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-lg font-semibold text-brand-700">{{ doctor.name.replace(/^dr\.?\s*/i, '').slice(0, 2).toUpperCase() }}</div>
          <div><h3 class="font-semibold">{{ doctor.name }}</h3><p class="mt-1 text-sm text-slate-600">{{ doctor.unit === 'anak' ? 'Ruang anak' : 'IGD dan ruangan' }}</p></div>
        </article>
      </div>
    </section>
    <section v-if="news.length" class="mt-10">
      <div class="flex flex-wrap items-end justify-between gap-3"><h2 class="text-2xl font-semibold tracking-tight">Berita terbaru</h2><NuxtLink to="/berita" class="text-sm font-semibold text-brand-700">Semua berita</NuxtLink></div>
      <div class="mt-5 grid gap-5 md:grid-cols-3"><article v-for="item in news" :key="item.id" class="panel flex flex-col p-6"><p class="text-sm text-brand-700">{{ prettyDate(item.date) }}</p><h3 class="mt-4 text-lg font-semibold leading-snug">{{ item.title }}</h3><p class="mt-3 text-sm leading-relaxed text-slate-700">{{ item.summary || item.content.slice(0, 180) }}</p><NuxtLink :to="'/berita/' + item.id" class="mt-5 text-sm font-semibold text-brand-700">Baca berita</NuxtLink></article></div>
    </section>
    <section v-if="site.hospital.value?.address || site.hospital.value?.phone || site.hospital.value?.email" class="panel mt-10 p-6 sm:p-8">
      <h2 class="text-xl font-semibold">Kontak</h2>
      <p v-if="site.hospital.value?.address" class="mt-5 flex items-start gap-3 text-sm leading-relaxed text-slate-700"><MapPin :size="18" class="mt-0.5 shrink-0 text-brand-700" /><span>{{ site.hospital.value.address }}</span></p>
      <p v-if="site.hospital.value?.phone" class="mt-4 flex items-center gap-3 text-sm text-slate-700"><Phone :size="18" class="text-brand-700" /><span>{{ site.hospital.value.phone }}</span></p>
      <p v-if="site.hospital.value?.email" class="mt-4 text-sm text-slate-700">{{ site.hospital.value.email }}</p>
    </section>
  </div>
</template>
