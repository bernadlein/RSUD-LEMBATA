<script setup lang="ts">
import { HOSPITAL_NAME } from '../domain/branding'
import PublicSectionHeading from '../components/public/SectionHeading.vue'
import PublicDoctorCard from '../components/public/DoctorCard.vue'
import PublicNewsCard from '../components/public/NewsCard.vue'
import PublicContactPanel from '../components/public/ContactPanel.vue'
import PublicDoctorPortrait from '../components/public/DoctorPortrait.vue'

definePageMeta({ layout: 'public' })
const { hospital, pending, error, refresh, identity, contacts, doctors, news, latestNews, highlight, highlightRows, highlightPreview, highlightUrl, month, timezone, updatedAt } = usePublicPortal()
useSeoMeta({ title: HOSPITAL_NAME, description: () => hospital.value?.about.slice(0, 155) || 'Jadwal dokter, layanan, dan informasi RSUD LEWOLEBA.', robots: 'index, follow' })
</script>
<template>
  <section class="public-home-hero">
    <div class="public-container grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-20">
      <div>
        <p class="public-eyebrow">Rumah Sakit Umum Daerah · {{ identity.city }}</p>
        <h1 class="public-home-title mt-5 max-w-xl">{{ identity.name }}</h1>
        <p class="mt-6 max-w-md text-base leading-8 text-slate-600 sm:text-lg">
          Jadwal dokter dan informasi pelayanan untuk Anda.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <NuxtLink to="/jadwal-dokter" class="public-button public-button-primary">Lihat jadwal dokter</NuxtLink>
          <NuxtLink v-if="contacts.length" to="/#kontak" class="public-button public-button-outline">
            Hubungi rumah sakit
          </NuxtLink>
          <NuxtLink v-else-if="news.length" to="/berita" class="public-button public-button-outline">Berita RS</NuxtLink>
        </div>
        <div
          v-if="doctors.length || hospital?.services.length"
          class="mt-9 flex flex-wrap gap-x-8 gap-y-5 border-t border-brand-200/60 pt-6"
        >
          <div v-if="doctors.length">
            <p class="text-2xl font-semibold tracking-tight text-brand-700">{{ doctors.length }}</p>
            <p class="mt-1 text-xs text-slate-600">Dokter</p>
          </div>
          <div v-if="hospital?.services.length">
            <p class="text-2xl font-semibold tracking-tight text-brand-700">{{ hospital.services.length }}</p>
            <p class="mt-1 text-xs text-slate-600">Layanan</p>
          </div>
        </div>
      </div>
      <section class="public-highlight" aria-labelledby="home-schedule-heading">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="public-eyebrow">Jadwal pelayanan</p>
          <span v-if="highlight?.today" class="public-pill public-pill-lime">Hari ini</span>
          <span v-else-if="month" class="public-pill public-pill-teal">{{ month }}</span>
        </div>
        <h2 id="home-schedule-heading" class="mt-4 text-xl font-semibold leading-snug tracking-tight">
          {{ highlight?.label || 'Jadwal dokter' }}
        </h2>
        <p v-if="pending && !hospital" class="py-7 text-sm text-slate-600" role="status">Memuat jadwal…</p>
        <div v-else-if="error" class="py-6" role="status">
          <p class="text-sm leading-7 text-slate-600">Informasi belum dapat dimuat.</p>
          <button type="button" class="public-button public-button-outline mt-4" @click="refresh()">Muat ulang</button>
        </div>
        <template v-else-if="month">
          <div class="mt-5">
            <div v-for="row in highlightPreview" :key="row.id" class="public-highlight-row">
              <div class="flex min-w-0 items-center gap-3">
                <PublicDoctorPortrait :photo-url="row.photoUrl" :name="row.doctorName" :initials="row.initials" :tone="row.tone" />
                <div class="min-w-0">
                  <p class="text-sm font-semibold">{{ row.doctorName }}</p>
                  <p class="mt-1 text-[11px] text-slate-600">{{ row.unitLabel }}</p>
                </div>
              </div>
              <p class="shrink-0 text-right text-xs font-semibold tabular-nums text-brand-700">
                {{ row.timeLabel }}
                <span class="mt-1 block text-[11px] font-medium text-slate-600">{{ timezone }}</span>
              </p>
            </div>
          </div>
          <p v-if="!highlightRows.length" class="py-6 text-sm leading-7 text-slate-600">
            Tidak ada jadwal dinas pada tanggal ini.
          </p>
        </template>
        <p v-else class="py-7 text-sm text-slate-600">Jadwal belum tersedia.</p>
        <NuxtLink :to="highlightUrl" class="public-button public-button-lime mt-4 w-full">Jadwal lengkap</NuxtLink>
        <p v-if="updatedAt" class="mt-4 text-center text-[11px] text-slate-600">Diperbarui {{ updatedAt }}</p>
      </section>
    </div>
  </section>
  <div class="public-container">
    <nav class="public-quick-links" aria-label="Akses cepat">
      <NuxtLink to="/jadwal-dokter" class="public-quick-link">
        <div>
          <p class="text-sm font-semibold">Jadwal dokter</p>
          <p v-if="month" class="mt-1 text-xs text-slate-600">{{ month }}</p>
        </div>
        <span class="public-quick-number" aria-hidden="true">01</span>
      </NuxtLink>
      <NuxtLink v-if="hospital?.services.length" to="/#layanan" class="public-quick-link">
        <div>
          <p class="text-sm font-semibold">Layanan rumah sakit</p>
          <p class="mt-1 text-xs text-slate-600">{{ hospital.services.length }} layanan</p>
        </div>
        <span class="public-quick-number" aria-hidden="true">02</span>
      </NuxtLink>
      <NuxtLink v-else-if="doctors.length" to="/#dokter" class="public-quick-link">
        <div>
          <p class="text-sm font-semibold">Dokter kami</p>
          <p class="mt-1 text-xs text-slate-600">{{ doctors.length }} dokter</p>
        </div>
        <span class="public-quick-number" aria-hidden="true">02</span>
      </NuxtLink>
      <NuxtLink to="/berita" class="public-quick-link">
        <div>
          <p class="text-sm font-semibold">Berita & pengumuman</p>
          <p v-if="news.length" class="mt-1 text-xs text-slate-600">{{ news[0]?.dateLabel }}</p>
        </div>
        <span class="public-quick-number" aria-hidden="true">03</span>
      </NuxtLink>
    </nav>
    <section v-if="hospital?.services.length" id="layanan" class="public-section">
      <PublicSectionHeading eyebrow="Pelayanan" title="Layanan rumah sakit" />
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article v-for="(service, index) in hospital.services" :key="service" class="public-card public-service-card">
          <h3 class="max-w-xs text-lg font-semibold leading-snug tracking-tight">{{ service }}</h3>
          <span class="public-service-number" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
        </article>
      </div>
    </section>
    <section
      v-if="doctors.length"
      id="dokter"
      class="public-section"
      :class="{ 'border-t border-slate-100': hospital?.services.length }"
    >
      <PublicSectionHeading
        eyebrow="Tim medis"
        title="Dokter kami"
        :link="month ? '/jadwal-dokter' : undefined"
        :link-label="month ? 'Jadwal seluruh dokter' : undefined"
      />
      <div class="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <PublicDoctorCard
          v-for="doctor in doctors"
          :key="doctor.id"
          :item="doctor"
          :show-schedule="!!month"
          :timezone="timezone"
        />
      </div>
    </section>
    <section v-if="hospital?.about.trim()" id="tentang" class="public-section">
      <div class="public-about grid gap-7 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
        <div>
          <p class="public-eyebrow">Tentang rumah sakit</p>
          <h2 class="public-section-title mt-4">{{ identity.name }}</h2>
          <p class="mt-4 text-sm text-brand-700">{{ identity.city }}</p>
        </div>
        <div class="whitespace-pre-line text-sm leading-8 text-slate-700 sm:text-base">{{ hospital.about }}</div>
      </div>
    </section>
    <section v-if="news.length" class="public-section border-t border-slate-100">
      <PublicSectionHeading eyebrow="Informasi terbaru" title="Berita & pengumuman" link="/berita" link-label="Semua berita" />
      <div class="grid gap-5 md:grid-cols-3">
        <PublicNewsCard v-for="(item, index) in latestNews" :key="item.id" :item="item" :featured="index === 0" />
      </div>
    </section>
    <div v-if="contacts.length" class="pb-12 pt-3 sm:pb-16">
      <PublicContactPanel :name="identity.name" :contacts="contacts" />
    </div>
  </div>
</template>
