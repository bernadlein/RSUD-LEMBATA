<script setup lang="ts">
import { AlertCircle, History, CheckCircle2 } from '@lucide/vue'
import { prettyDate } from '../domain/calendar'
import type { Issue } from '../domain/types'
const props = withDefaults(defineProps<{ issues: Issue[]; limit?: number }>(), { limit: 6 })
const { data } = useWorkspace()
const filter = ref<'new' | 'history' | 'all'>('new')
const filtered = computed(() => props.issues.filter(i => filter.value === 'all' || (filter.value === 'history' ? i.historical : !i.historical)))
const doctorName = (id: string | null) => data.value?.doctors.find(d => d.id === id)?.name ?? 'Cakupan layanan'
</script>
<template>
  <div>
    <div class="mb-4 flex flex-wrap gap-2"><button v-for="f in [{ key: 'new', label: 'Periode penyesuaian' }, { key: 'history', label: 'Riwayat' }, { key: 'all', label: 'Semua' }]" :key="f.key" class="rounded-lg px-3 py-1.5 text-xs font-medium" :class="filter === f.key ? 'bg-brand-50 text-brand-700' : 'text-slate-400 hover:bg-slate-50'" :aria-pressed="filter === f.key" @click="filter = f.key as typeof filter">{{ f.label }}</button></div>
    <div v-if="!filtered.length" class="flex gap-3 rounded-xl bg-brand-50 p-4"><CheckCircle2 :size="19" class="shrink-0 text-brand-600"/><p class="text-sm text-brand-800">Tidak ada catatan pada kategori ini.</p></div>
    <div v-else class="divide-y divide-slate-100"><div v-for="i in filtered.slice(0, limit)" :key="i.id" class="flex gap-3 py-3.5"><component :is="i.historical ? History : AlertCircle" :size="17" class="mt-0.5 shrink-0" :class="i.severity === 'error' ? 'text-rose-500' : 'text-amber-500'"/><div class="min-w-0"><p class="text-xs font-semibold">{{ doctorName(i.doctorId) }} <span class="ml-1 font-normal text-slate-400">· {{ prettyDate(i.date) }}</span></p><p class="mt-1 text-xs leading-relaxed text-slate-500">{{ i.message }}</p></div></div></div>
    <p v-if="filtered.length > limit" class="mt-3 text-xs text-slate-400">Menampilkan {{ limit }} dari {{ filtered.length }} catatan. Pilih dokter atau periode untuk mempersempit tampilan.</p>
  </div>
</template>
