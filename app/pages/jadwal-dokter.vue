<script setup lang="ts">
import { CalendarDays, Search, Clock3 } from '@lucide/vue'
import { attendanceDate } from '../domain/attendance'
import { monthDates, monthLabel, prettyDate } from '../domain/calendar'
definePageMeta({ layout: 'public' })
const site = usePublicHospital(), selected = ref(''), query = ref('')
const days = computed(() => site.hospital.value?.schedule.month ? monthDates(site.hospital.value.schedule.month) : [])
const rows = computed(() => site.hospital.value?.schedule.rows.filter(row => row.date === selected.value && row.doctorName.toLowerCase().includes(query.value.trim().toLowerCase())) ?? [])
watch(() => site.hospital.value?.schedule.month, () => {
  const today = attendanceDate(new Date(), site.hospital.value?.timezone || 'Asia/Makassar')
  selected.value = days.value.includes(today) ? today : days.value[0] ?? ''
}, { immediate: true })
const units = { igd: 'IGD', ruangan: 'Ruangan', anak: 'Ruang anak', lain: 'Layanan lainnya' }
useSeoMeta({ title: () => 'Jadwal dokter · ' + (site.hospital.value?.name || 'Rumah Sakit'), robots: 'index, follow' })
</script>
<template>
  <div class="mx-auto max-w-7xl px-5 py-9 lg:px-8">
    <section class="app-hero rounded-[1.75rem] p-7 sm:p-9"><p class="eyebrow text-brand-700">JADWAL PELAYANAN</p><h1 class="mt-4 text-3xl font-semibold tracking-tight">Jadwal dokter</h1><p class="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">Lihat jadwal dinas yang telah diterbitkan rumah sakit. Konfirmasikan layanan dan perubahan waktu kepada rumah sakit.</p><p v-if="site.hospital.value?.schedule.month" class="mt-4 text-sm font-semibold text-brand-800">{{ monthLabel(site.hospital.value.schedule.month) }}</p></section>
    <p v-if="site.pending.value" class="panel mt-6 p-7 text-sm text-slate-500">Memuat jadwal…</p>
    <section v-else-if="site.error.value" class="panel mt-6 p-7"><p class="text-sm text-slate-600">Jadwal belum dapat dimuat.</p><button class="btn btn-secondary mt-4" @click="site.refresh()">Coba lagi</button></section>
    <section v-else-if="!days.length" class="panel mt-6 p-8 text-sm text-slate-600">Belum ada jadwal dokter yang diterbitkan.</section>
    <template v-else>
      <div class="mt-6 flex flex-col gap-3 sm:flex-row"><div class="sm:w-64"><label for="public-day" class="label">Tanggal dinas</label><select id="public-day" v-model="selected" class="field"><option v-for="day in days" :key="day" :value="day">{{ prettyDate(day) }}</option></select></div><div class="flex-1"><label for="public-search" class="label">Cari dokter</label><div class="relative"><Search class="absolute top-3 left-3 text-slate-400" :size="17" /><input id="public-search" v-model="query" class="field pl-10" placeholder="Nama dokter" /></div></div></div>
      <div class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><article v-for="row in rows" :key="row.doctorId" class="panel p-6"><div class="flex items-start justify-between gap-3"><div><h2 class="text-lg font-semibold">{{ row.doctorName }}</h2><p class="mt-2 text-xs text-slate-500">{{ units[row.unit] }}</p></div><span class="tag bg-brand-50 text-brand-800">{{ row.code }}</span></div><div class="mt-5 rounded-xl bg-brand-50/60 p-4"><p class="flex items-center gap-2 text-xs text-brand-700"><Clock3 :size="14" />Jam dinas</p><p class="mt-3 text-xl font-semibold tabular-nums">{{ row.start && row.end ? row.start + '–' + row.end : 'Perlu konfirmasi' }}</p><p v-if="row.start && row.end && row.end <= row.start" class="mt-2 text-xs text-slate-500">Selesai pada hari berikutnya.</p></div><p class="mt-4 text-xs leading-relaxed text-slate-600">{{ row.label }}</p></article></div>
      <section v-if="!rows.length" class="panel mt-6 p-8 text-center"><CalendarDays class="mx-auto text-brand-600" :size="26" /><p class="mt-4 text-sm text-slate-600">Tidak ada jadwal yang cocok pada tanggal dan pencarian ini.</p></section>
      <p class="mt-5 text-xs leading-relaxed text-slate-500">Periode yang ditampilkan mengikuti publikasi terakhir rumah sakit.</p>
    </template>
  </div>
</template>
