<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; eyebrow?: string }>()
</script>
<template>
  <div class="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div><p v-if="eyebrow" class="eyebrow mb-2">{{ eyebrow }}</p><h1 class="text-2xl font-semibold tracking-tight sm:text-[28px]">{{ title }}</h1><p v-if="subtitle" class="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{{ subtitle }}</p></div>
    <div class="flex shrink-0 flex-wrap gap-2"><slot /></div>
  </div>
</template>
