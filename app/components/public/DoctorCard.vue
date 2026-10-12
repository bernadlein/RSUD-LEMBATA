<script setup lang="ts">
import PublicDoctorPortrait from './DoctorPortrait.vue'
import type { PublicDoctorItem } from '../../domain/public-portal'
defineProps<{ item: PublicDoctorItem; showSchedule: boolean; timezone: string }>()
</script>
<template>
  <article class="public-card public-doctor-card" :class="{ 'is-lime': item.tone === 'lime' }">
    <div class="flex items-center gap-4">
      <PublicDoctorPortrait
        :photo-url="item.photoUrl"
        :name="item.name"
        :initials="item.initials"
        :tone="item.tone"
        size="large"
      />
      <div>
        <h3 class="text-lg font-semibold tracking-tight">{{ item.name }}</h3>
        <p class="mt-1.5 text-xs text-slate-600">{{ item.unitLabel }}</p>
      </div>
    </div>
    <div v-if="item.nextDuty" class="mt-6 border-t border-slate-100 pt-4">
      <p class="text-[11px] font-medium text-slate-600">Jadwal terdekat</p>
      <p class="mt-2 text-xs leading-5 text-slate-700">{{ item.nextDuty.dateLabel }}</p>
      <p class="mt-1 text-sm font-semibold tabular-nums text-brand-700">
        {{ item.nextDuty.timeLabel }}
        <span class="text-[11px] font-medium">{{ timezone }}</span>
      </p>
    </div>
    <NuxtLink
      v-if="showSchedule"
      :to="item.scheduleUrl"
      class="public-text-link mt-5 inline-flex"
      :aria-label="'Lihat jadwal ' + item.name"
    >
      Lihat jadwal
    </NuxtLink>
  </article>
</template>
