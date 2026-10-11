<script setup lang="ts">
import { CalendarDays } from '@lucide/vue'
import { monthLabel } from '../domain/calendar'
const { months, activeMonth } = useWorkspace()
</script>
<template><label class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><CalendarDays :size="17" class="text-brand-600"/><span class="sr-only">Bulan jadwal</span><select v-model="activeMonth" class="max-w-44 bg-transparent font-medium outline-none"><option v-for="m in months" :key="m" :value="m">{{ monthLabel(m) }}</option><option v-if="!months.length" :value="activeMonth">Belum ada jadwal</option></select></label></template>
