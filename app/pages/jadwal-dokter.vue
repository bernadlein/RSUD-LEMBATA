<script setup lang="ts">
import { Search } from '@lucide/vue'
import { HOSPITAL_NAME } from '../domain/branding'
import PublicPageHero from '../components/public/PageHero.vue'
import PublicScheduleCard from '../components/public/ScheduleCard.vue'
import PublicStatusPanel from '../components/public/StatusPanel.vue'

definePageMeta({ layout: 'public' })
const { pending, error, refresh, days, month, timezone, updatedAt, selected, query, unit, results, date, windowDays, doctorCount, availableUnits, clearFilters } = usePublicSchedule()
useSeoMeta({ title: 'Jadwal dokter · ' + HOSPITAL_NAME, description: 'Jadwal dinas dokter RSUD LEWOLEBA menurut tanggal dan unit pelayanan.', robots: 'index, follow' })
</script>
<template>
  <PublicPageHero eyebrow="Jadwal pelayanan" title="Jadwal dokter" :meta="month" />
  <div class="public-container public-section">
    <PublicStatusPanel v-if="pending && !days.length" state="loading" title="Memuat jadwal…" />
    <PublicStatusPanel
      v-else-if="error"
      state="error"
      title="Jadwal belum dapat dimuat."
      action-label="Coba lagi"
      @action="refresh()"
    />
    <PublicStatusPanel v-else-if="!days.length" state="empty" title="Jadwal belum tersedia." />
    <template v-else>
      <section class="public-filter-panel" aria-label="Filter jadwal dokter">
        <div class="grid gap-5 md:grid-cols-[1fr_1.25fr_0.85fr]">
          <div>
            <label for="public-day" class="label">Tanggal dinas</label>
            <select id="public-day" v-model="selected" class="field min-h-12">
              <option v-for="day in days" :key="day.value" :value="day.value">{{ day.label }}</option>
            </select>
          </div>
          <div>
            <label for="public-search" class="label">Nama dokter</label>
            <div class="relative">
              <Search :size="17" class="pointer-events-none absolute top-4 left-3.5 text-slate-600" aria-hidden="true" />
              <input id="public-search" v-model="query" type="search" class="field min-h-12 pl-10" autocomplete="off" />
            </div>
          </div>
          <div>
            <label for="public-unit" class="label">Unit pelayanan</label>
            <select id="public-unit" v-model="unit" class="field min-h-12">
              <option v-for="option in availableUnits" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
        </div>
        <div class="mt-6 flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-7 sm:gap-3" role="group" aria-label="Pilihan tanggal dinas">
          <button
            v-for="day in windowDays"
            :key="day.value"
            type="button"
            class="public-date-button"
            :class="{ 'is-selected': selected === day.value, 'is-today': day.today }"
            :aria-pressed="selected === day.value"
            :aria-label="day.label + (day.today ? ', hari ini' : '')"
            @click="selected = day.value"
          >
            <span class="text-[11px] sm:text-xs">{{ day.weekday }}</span>
            <span class="text-lg font-semibold tabular-nums sm:text-xl">{{ day.number }}</span>
          </button>
        </div>
      </section>
      <div class="public-result-bar" aria-live="polite" aria-atomic="true">
        <div>
          <h2 class="text-base font-semibold tracking-tight">{{ date?.label }}</h2>
          <p class="mt-2 text-xs text-slate-600">{{ doctorCount }} dokter · Waktu {{ timezone }}</p>
        </div>
        <button
          v-if="query.trim() || unit !== 'all'"
          type="button"
          class="public-text-link min-h-11"
          @click="clearFilters"
        >
          Hapus filter
        </button>
      </div>
      <div v-if="results.length" class="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <PublicScheduleCard v-for="row in results" :key="row.id" :item="row" :timezone="timezone" />
      </div>
      <PublicStatusPanel
        v-else
        state="empty"
        title="Tidak ada jadwal yang sesuai."
        :action-label="query.trim() || unit !== 'all' ? 'Hapus filter' : undefined"
        @action="clearFilters"
      />
      <p v-if="updatedAt" class="mt-8 text-xs text-slate-600">Jadwal diperbarui {{ updatedAt }}</p>
    </template>
  </div>
</template>
