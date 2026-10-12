<script setup lang="ts">
import { Pencil, CalendarDays, Clock3 } from '@lucide/vue'
import type { Doctor, DoctorSummary } from '../domain/types'
import { formatHours, prettyDate } from '../domain/calendar'
const props = defineProps<{ doctor: Doctor; number: number; summary?: DoctorSummary; canEdit: boolean; photoUrl?: string | null }>()
defineEmits<{ edit: [doctor: Doctor] }>()
const initials = (name: string) => name.replace(/^dr\.?\s*/i, '').slice(0, 2).toUpperCase()
const photoFailed = ref(false)
const showPhoto = computed(() => !!props.photoUrl && !photoFailed.value)
watch(() => props.photoUrl, () => { photoFailed.value = false })
</script>
<template>
  <article class="doctor-card flex h-full flex-col">
    <div class="relative flex aspect-[4/5] min-h-64 flex-col justify-between overflow-hidden p-5 text-brand-800" :class="doctor.unit === 'anak' ? 'doctor-poster-child' : 'doctor-poster'">
      <img v-if="showPhoto" :src="photoUrl || undefined" :alt="'Foto dokter ' + doctor.name" class="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" @error="photoFailed = true" />
      <div class="relative z-1 flex items-center justify-between"><span class="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold tracking-widest text-brand-800">DOKTER {{ String(number).padStart(2, '0') }}</span><span class="rounded-full px-2.5 py-1.5 text-xs font-semibold" :class="doctor.active ? 'bg-lime-soft text-ink' : 'bg-slate-100 text-slate-600'">{{ doctor.active ? 'Aktif' : 'Nonaktif' }}</span></div>
      <span v-if="!showPhoto" aria-hidden="true" class="absolute -right-5 -bottom-9 text-[155px] leading-none font-bold tracking-tighter text-brand-600/10">{{ String(number).padStart(2, '0') }}</span>
      <div class="relative z-1 flex items-end" :class="showPhoto ? 'justify-end' : 'justify-between'"><div v-if="!showPhoto" class="flex h-20 w-20 items-center justify-center rounded-[1.35rem] border border-brand-100 bg-white/85 text-3xl font-medium tracking-tight text-brand-700">{{ initials(doctor.name) }}</div><span class="mb-1 max-w-36 rounded-xl bg-white/90 px-3 py-2 text-right text-xs leading-relaxed text-brand-800">{{ doctor.unit === 'anak' ? 'Pelayanan ruang anak' : 'IGD dan ruangan' }}</span></div>
    </div>
    <div class="flex flex-1 flex-col p-5">
      <h2 class="text-xl font-semibold tracking-tight">{{ doctor.name.replace(/^dr\.?\s*/i, '') }}<span class="ml-2 text-xs font-normal text-slate-600">dokter</span></h2>
      <p class="mt-1.5 text-xs text-slate-600">{{ doctor.unit === 'anak' ? 'Khusus ruang anak' : 'Rotasi layanan' }}</p>
      <div class="my-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3.5"><div><p class="flex items-center gap-1.5 text-xs text-slate-600"><Clock3 :size="12" />Jam terjadwal</p><p class="mt-2 text-lg font-semibold tabular-nums">{{ summary ? formatHours(summary.totalHours) : '—' }}<span v-if="summary" class="ml-1 text-xs font-normal text-slate-600">jam</span></p></div><div class="border-l border-slate-200 pl-3"><p class="flex items-center gap-1.5 text-xs text-slate-600"><CalendarDays :size="12" />Hari dinas</p><p class="mt-2 text-lg font-semibold tabular-nums">{{ summary?.workDays ?? '—' }}<span v-if="summary" class="ml-1 text-xs font-normal text-slate-600">hari</span></p></div></div>
      <p class="text-xs leading-relaxed text-slate-600">{{ doctor.joinedOn ? `Bergabung ${prettyDate(doctor.joinedOn)}` : 'Terdaftar dalam tim pelayanan' }}</p>
      <p v-if="doctor.leave.length" class="mt-2 text-xs leading-relaxed text-amber-700">{{ doctor.leave.length }} periode cuti · {{ summary?.leaveDays ?? 0 }} hari pada bulan terpilih</p>
      <button v-if="canEdit" class="btn btn-secondary mt-5 w-full" :aria-label="`Kelola dokter ${doctor.name}`" @click="$emit('edit', doctor)"><Pencil :size="14" />Kelola dokter</button>
    </div>
  </article>
</template>
