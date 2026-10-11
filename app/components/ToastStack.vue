<script setup lang="ts">
import { X, CheckCircle2, AlertCircle } from '@lucide/vue'
const { messages, dismiss } = useNotifications()
</script>
<template>
  <div class="toast-stack fixed right-4 bottom-5 z-100 flex max-w-[calc(100vw-2rem)] flex-col gap-3" aria-live="polite">
    <div v-for="m in messages" :key="m.id" class="flex w-96 max-w-full items-start gap-3 rounded-xl border bg-white p-4 shadow-xl" :class="m.error ? 'border-rose-200' : 'border-brand-200'" :role="m.error ? 'alert' : 'status'">
      <component :is="m.error ? AlertCircle : CheckCircle2" :size="19" class="mt-0.5 shrink-0" :class="m.error ? 'text-rose-600' : 'text-brand-600'" />
      <p class="flex-1 text-sm leading-relaxed">{{ m.text }}</p>
      <button aria-label="Tutup pemberitahuan" class="text-slate-400" @click="dismiss(m.id)"><X :size="16" /></button>
    </div>
  </div>
</template>
