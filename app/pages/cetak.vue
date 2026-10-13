<script setup lang="ts">
import { Printer } from '@lucide/vue'
import { formatHours, monthLabel, weekday } from '../domain/calendar'
import { schedulePrintData } from '../domain/schedule-print'
import { shiftColorClass } from '../domain/shift-colors'

const w = useWorkspace()
const document = computed(() => w.data.value && w.plan.value ? schedulePrintData(w.data.value, w.plan.value) : null)
const unresolved = computed(() => w.issues.value.filter(i => i.severity === 'error'))
const showWarnings = ref(true)
const total = computed(() => w.summaries.value.reduce((n, r) => n + r.knownHours, 0))
useHead({ title: computed(() => `Jadwal Dokter ${monthLabel(w.activeMonth.value)} · RSUD LEWOLEBA`) })
function print() { window.print() }
</script>
<template>
  <div class="screen-only">
    <PageHeading title="Cetak jadwal" eyebrow="Dokumen bulanan">
      <MonthSelect />
      <button class="btn btn-primary" :disabled="!w.plan.value" @click="print"><Printer :size="16" />Cetak / Simpan PDF</button>
    </PageHeading>
    <div v-if="w.isAdmin.value" class="mb-5 rounded-xl border border-brand-100 bg-brand-50 px-5 py-3">
      <NuxtLink to="/pengaturan" class="text-xs font-semibold text-brand-700">Atur nama, jabatan & NIP</NuxtLink>
    </div>
    <label v-if="unresolved.length" class="mb-4 flex items-center gap-2 text-xs text-slate-600">
      <input v-model="showWarnings" type="checkbox" />Sertakan catatan {{ unresolved.length }} benturan dinas pada dokumen
    </label>
  </div>
  <div v-if="document && w.plan.value && w.data.value" class="print-wrap scrollbar-thin panel overflow-x-auto p-5">
    <article class="print-document mx-auto min-w-[1100px] max-w-[1400px] p-5 text-xs">
      <header class="mb-4 text-center">
        <h1 class="text-xl font-bold tracking-wide">JADWAL DOKTER JAGA {{ document.hospital }}</h1>
        <p class="mt-1 font-semibold">{{ monthLabel(w.activeMonth.value).toUpperCase() }}</p>
        <p class="mt-1 text-[9px] text-slate-600">
          {{ w.plan.value.locked ? 'Jadwal terkunci' : 'Draf jadwal' }} ·
          {{ w.data.value.settings.timezone === 'Asia/Makassar' ? 'WITA' : w.data.value.settings.timezone === 'Asia/Jayapura' ? 'WIT' : 'WIB' }}
        </p>
      </header>
      <table>
        <thead>
          <tr class="bg-brand-50">
            <th class="print-number">No.</th><th class="print-name">Dokter</th>
            <th v-if="document.showPhone" class="print-phone">Nomor HP</th>
            <th v-for="(date, i) in document.dates" :key="date">
              <p class="text-[8px] font-normal">{{ weekday(date) }}</p><p class="mt-0.5">{{ i + 1 }}</p>
            </th>
            <th class="print-total">Jam</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in w.summaries.value" :key="row.doctor.id">
            <td>{{ i + 1 }}</td><td class="print-name font-medium">{{ row.doctor.name }}</td>
            <td v-if="document.showPhone" class="print-phone tabular-nums">{{ row.doctor.phone }}</td>
            <td
              v-for="date in document.dates"
              :key="date"
              :class="[shiftColorClass(w.plan.value.assignments[row.doctor.id]?.[date]), 'shift-fill']"
            >{{ w.plan.value.assignments[row.doctor.id]?.[date] === document.blankCode ? '' : w.plan.value.assignments[row.doctor.id]?.[date] || '—' }}</td>
            <td class="font-semibold">{{ formatHours(row.totalHours) }}</td>
          </tr>
          <tr>
            <td :colspan="document.dates.length + 2 + (document.showPhone ? 1 : 0)" class="text-right! pr-3! font-semibold">Total jam terjadwal</td>
            <td class="font-bold">{{ formatHours(total) }}</td>
          </tr>
        </tbody>
      </table>
      <section class="print-legend mt-3">
        <h2 class="mb-1.5 font-semibold">{{ document.legendTitle }}</h2>
        <div class="grid grid-cols-3 gap-x-5 gap-y-1">
          <p v-for="(entry, i) in document.legend" :key="i"><strong class="rounded px-1 py-0.5" :class="[shiftColorClass(entry.code), 'shift-fill']">{{ entry.code }}</strong>: {{ entry.label }}</p>
        </div>
      </section>
      <section class="print-clocks mt-3">
        <h2 class="mb-1.5 font-semibold">Jam dinas</h2>
        <div class="grid grid-cols-4 gap-x-4 gap-y-1">
          <p v-for="clock in document.clocks" :key="clock.code"><strong class="rounded px-1 py-0.5" :class="[shiftColorClass(clock.code), 'shift-fill']">{{ clock.code }}</strong> · {{ clock.label }} · {{ formatHours(clock.hours) }} jam</p>
        </div>
        <p v-if="document.clocks.some(clock => clock.label.includes('+1'))" class="mt-1 text-slate-600">+1 = hari berikutnya.</p>
      </section>
      <div v-if="document.notes.length" class="print-notes mt-3 space-y-1">
        <p v-for="(note, i) in document.notes" :key="i">{{ note }}</p>
      </div>
      <p v-if="w.summaries.value.some(row => row.emptyDays)" class="mt-2 text-[9px] text-amber-700">Jadwal belum lengkap.</p>
      <p v-if="showWarnings && unresolved.length" class="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[9px] text-amber-800">
        Catatan pemeriksaan: {{ unresolved.length }} benturan dinas, termasuk {{ unresolved.filter(i => i.historical).length }} catatan riwayat.
      </p>
      <div class="signature-block mt-5 grid grid-cols-2 gap-20 px-8 text-center text-xs">
        <div v-for="signer in document.signatories" :key="signer.id">
          <p class="min-h-4">{{ signer.preamble }}</p><p class="mt-1 font-semibold">{{ signer.title }}</p>
          <div class="signature-space h-16" />
          <p class="font-semibold underline underline-offset-2">{{ signer.name }}</p>
          <p v-if="signer.nip" class="mt-1">NIP. {{ signer.nip }}</p>
        </div>
      </div>
    </article>
  </div>
</template>
