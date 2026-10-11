<script setup lang="ts">
import { Check, Clock3 } from '@lucide/vue'
import type { Doctor } from '../domain/types'
import { formatHours, prettyDate } from '../domain/calendar'
import { clockLabel, planShifts, shiftHours, shiftStyle, unitLabels } from '../domain/shifts'
import { setAssignment } from '../domain/commands'
const props = defineProps<{ doctor: Doctor; date: string }>()
const emit = defineEmits<{ close: [] }>()
const w = useWorkspace()
const selected = ref(w.plan.value?.assignments[props.doctor.id]?.[props.date] ?? '')
const shifts = computed(() => w.data.value && w.plan.value ? planShifts(w.data.value, w.plan.value).filter(s => s.active) : [])
const chosen = computed(() => shifts.value.find(s => s.code === selected.value))
async function save() { const ok = await w.mutate(data => setAssignment(data, w.activeMonth.value, props.doctor.id, props.date, selected.value, w.role.value), `Dinas ${props.doctor.name}, ${props.date}: ${selected.value || 'kosong'}`); if (ok) emit('close') }
</script>
<template><AppModal :title="doctor.name" wide @close="emit('close')"><p class="mb-5 text-sm text-slate-500">{{ prettyDate(date) }} · pilih kode dinas</p><form @submit.prevent="save"><div class="grid max-h-[45dvh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3"><button v-for="s in shifts" :key="s.code" type="button" class="relative rounded-xl border p-3 text-left transition-colors" :class="selected === s.code ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-brand-200'" :aria-pressed="selected === s.code" @click="selected = s.code"><span class="tag mb-2 font-semibold" :class="shiftStyle(s)">{{ s.code }}</span><Check v-if="selected === s.code" class="absolute top-3 right-3 text-brand-600" :size="16"/><p class="text-xs font-medium">{{ unitLabels[s.unit] }}</p><p class="mt-1 text-[11px] text-slate-500">{{ clockLabel(s) }}</p><p class="mt-1 text-xs font-semibold">{{ formatHours(shiftHours(s)) }} jam</p></button></div><div class="my-5 flex items-center gap-3 rounded-xl bg-slate-50 p-4"><Clock3 :size="18" class="text-brand-600"/><p class="text-xs leading-relaxed text-slate-500">{{ chosen ? `${chosen.label} · ${clockLabel(chosen)}` : 'Isian kosong belum dihitung sebagai kerja atau libur.' }}</p></div><div class="flex flex-wrap justify-between gap-3"><button type="button" class="btn btn-quiet text-xs" @click="selected = ''">Kosongkan isian</button><div class="flex gap-2"><button type="button" class="btn btn-secondary" @click="emit('close')">Batal</button><button class="btn btn-primary" :disabled="!w.canEdit.value">Simpan dinas</button></div></div></form></AppModal></template>
