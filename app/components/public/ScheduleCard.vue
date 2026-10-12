<script setup lang="ts">
import PublicDoctorPortrait from './DoctorPortrait.vue'
import type { PublicScheduleItem } from '../../domain/public-portal'
defineProps<{ item: PublicScheduleItem; timezone: string }>()
</script>
<template>
  <article class="public-card public-schedule-card" :class="{ 'is-lime': item.tone === 'lime' }">
    <div class="flex items-start justify-between gap-3">
      <span class="public-pill" :class="item.tone === 'lime' ? 'public-pill-lime' : 'public-pill-teal'">
        {{ item.unitLabel }}
      </span>
      <span class="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{{ item.code }}</span>
    </div>
    <div class="mt-6 flex items-center gap-3">
      <PublicDoctorPortrait :photo-url="item.photoUrl" :name="item.doctorName" :initials="item.initials" :tone="item.tone" />
      <h3 class="text-lg font-semibold tracking-tight">{{ item.doctorName }}</h3>
    </div>
    <div class="public-duty-time">
      <p class="text-xs font-medium text-slate-600">
        Jam dinas
        <span class="ml-1 text-brand-700">{{ timezone }}</span>
      </p>
      <p class="mt-2 text-[25px] font-semibold tracking-tight tabular-nums">{{ item.timeLabel }}</p>
      <p v-if="item.note" class="mt-2 text-xs leading-5 text-slate-600">{{ item.note }}</p>
    </div>
    <div class="mt-5 flex items-start justify-between gap-4">
      <p class="text-xs leading-6 text-slate-600">{{ item.label }}</p>
      <span v-if="item.hoursLabel" class="shrink-0 text-xs font-semibold leading-6 text-brand-700">{{ item.hoursLabel }}</span>
    </div>
  </article>
</template>
