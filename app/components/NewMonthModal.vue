<script setup lang="ts">
import { createMonth } from '../domain/commands'
import { monthLabel } from '../domain/calendar'
const emit = defineEmits<{ close: [] }>()
const w = useWorkspace()
const selected = ref(''), copyFrom = ref('')
async function submit() {
  if (!selected.value) return
  const ok = await w.mutate(data => createMonth(data, selected.value, w.role.value, copyFrom.value || undefined), `Membuat jadwal ${selected.value}`)
  if (ok) { w.activeMonth.value = selected.value; emit('close') }
}
</script>
<template><AppModal title="Buat jadwal bulanan" @close="emit('close')"><form class="space-y-5" @submit.prevent="submit"><div><label for="new-month" class="label">Bulan jadwal</label><input id="new-month" v-model="selected" type="month" required class="field"/></div><div><label for="copy-month" class="label">Mulai dari</label><select id="copy-month" v-model="copyFrom" class="field"><option value="">Jadwal kosong</option><option v-for="m in w.months.value" :key="m" :value="m">Salinan {{ monthLabel(m) }}</option></select></div><p class="rounded-xl bg-brand-50 p-4 text-xs leading-relaxed text-brand-800">Cuti dan tanggal mulai dokter tetap diperhitungkan. Jadwal salinan perlu diperiksa kembali karena hari dan ketersediaan dapat berbeda.</p><div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" @click="emit('close')">Batal</button><button class="btn btn-primary" :disabled="w.saving.value || !selected">Buat jadwal</button></div></form></AppModal></template>
