<script setup lang="ts">
import { createMonth } from '../domain/commands'
import { addDays, formatHours, monthLabel } from '../domain/calendar'
import { applyGeneratedMonth, generatorHistoryDays } from '../domain/scheduler'
import type { GeneratedMonth } from '../domain/scheduler'
import { getGeneratedMonth } from '../services/month-generator'

const emit = defineEmits<{ close: [] }>()
const w = useWorkspace()
const selected = ref(''), mode = ref<'auto' | 'empty' | 'copy'>('auto'), copyFrom = ref('')
const preferRegular = ref(true), rested = ref(false), calculating = ref(false), error = ref('')
const proposal = shallowRef<GeneratedMonth | null>(null)
let controller: AbortController | null = null
let generation = 0
const existing = computed(() => !!w.data.value?.plans[selected.value])
const historyDays = computed(() => w.data.value ? generatorHistoryDays(w.data.value) : 0)
const hasPrevious = computed(() => selected.value ? !!w.data.value?.plans[addDays(`${selected.value}-01`, -1).slice(0, 7)] : false)
const disabled = computed(() => !w.canEdit.value || w.loading.value || !selected.value || existing.value)

function reset() {
  generation++; controller?.abort(); controller = null
  calculating.value = false; proposal.value = null; error.value = ''
}
watch([selected, mode, copyFrom, preferRegular, rested, w.revision, w.id, w.role, () => w.session.value?.user.id, w.loading], reset)
watch(selected, () => { rested.value = false })
onBeforeUnmount(reset)
function close() { if (!w.saving.value) { reset(); emit('close') } }
async function calculate() {
  if (!w.data.value || disabled.value || calculating.value) return
  reset()
  const request = generation, abort = new AbortController()
  controller = abort; calculating.value = true
  try {
    const result = await getGeneratedMonth(w.data.value, selected.value, { preferRegular: preferRegular.value, restedBeforeFirstMonth: rested.value }, abort.signal)
    if (request === generation) proposal.value = result
  } catch (e) {
    if (request === generation && !abort.signal.aborted) error.value = e instanceof Error ? e.message : 'Perhitungan belum berhasil.'
  } finally { if (request === generation) { calculating.value = false; controller = null } }
}
async function submit() {
  if (disabled.value || calculating.value) return
  const month = selected.value, generated = proposal.value
  if (mode.value === 'auto' && !generated) return
  const ok = await w.mutate(data => mode.value === 'auto'
    ? applyGeneratedMonth(data, generated!, w.role.value)
    : createMonth(data, month, w.role.value, mode.value === 'copy' ? copyFrom.value || undefined : undefined), `Membuat jadwal ${month}`)
  if (ok) { w.activeMonth.value = month; emit('close') }
}
</script>

<template>
  <AppModal title="Buat jadwal bulanan" wide @close="close">
    <form class="space-y-5" @submit.prevent="submit">
      <div class="grid gap-4 sm:grid-cols-2">
        <div><label for="new-month" class="label">Bulan jadwal</label><input id="new-month" v-model="selected" type="month" required class="field" :disabled="calculating || w.saving.value" /></div>
        <div><label for="month-mode" class="label">Cara membuat</label><select id="month-mode" v-model="mode" class="field" :disabled="calculating || w.saving.value"><option value="auto">Susun otomatis</option><option value="empty">Jadwal kosong</option><option value="copy">Salin bulan lain</option></select></div>
      </div>
      <p v-if="existing" role="alert" class="text-sm text-red-700">Jadwal bulan ini sudah tersedia. Pilih bulan lain.</p>
      <div v-if="mode === 'copy'"><label for="copy-month" class="label">Bulan sumber</label><select id="copy-month" v-model="copyFrom" required class="field" :disabled="w.saving.value"><option value="" disabled>Pilih bulan</option><option v-for="m in w.months.value" :key="m" :value="m">{{ monthLabel(m) }}</option></select></div>
      <template v-if="mode === 'auto'">
        <div class="space-y-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
          
          <label class="flex items-start gap-3"><input v-model="preferRegular" type="checkbox" class="mt-1 accent-brand-600" :disabled="calculating || w.saving.value" /><span>Utamakan dinas reguler</span></label>
          <label v-if="selected && !hasPrevious" class="flex items-start gap-3"><input v-model="rested" type="checkbox" class="mt-1 accent-brand-600" :disabled="calculating || w.saving.value" /><span>Bulan pertama: semua dokter telah istirahat tanpa dinas selama {{ historyDays }} hari sebelum tanggal mulai.</span></label>
        </div>
        <div aria-live="polite"><p v-if="calculating" class="text-sm text-slate-600">Sedang menyusun dan memeriksa jadwal…</p><p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ error }}</p></div>
        <section v-if="proposal" class="space-y-3" aria-label="Ringkasan hasil generator">
          <div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-semibold">Hasil {{ monthLabel(proposal.plan.month) }}</h3><span class="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800">Cakupan dan istirahat lolos pemeriksaan</span></div>
          <p class="text-sm text-slate-600">Selisih dokter rotasi yang tersedia sebulan penuh: <strong>{{ proposal.spread === null ? 'Belum ada kelompok pembanding' : `${formatHours(proposal.spread)} jam` }}</strong>.</p>
          <div class="overflow-x-auto rounded-xl border border-slate-200"><table class="w-full text-sm"><thead class="bg-slate-50 text-slate-600"><tr><th class="px-3 py-2 text-left font-medium">Dokter</th><th class="px-3 py-2 text-center font-medium">Hari tersedia</th><th class="px-3 py-2 text-center font-medium">Total jam</th><th class="px-3 py-2 text-center font-medium">Dinas 12 jam</th></tr></thead><tbody><tr v-for="row in proposal.rows" :key="row.id" class="border-t border-slate-100"><td class="px-3 py-2">{{ row.name }}<span v-if="row.unit === 'anak'" class="block text-xs text-slate-600">Khusus ruang anak</span></td><td class="px-3 py-2 text-center">{{ row.availableDays }}</td><td class="px-3 py-2 text-center font-semibold">{{ formatHours(row.hours) }}</td><td class="px-3 py-2 text-center">{{ row.longDays }}</td></tr></tbody></table></div>
          <ul class="space-y-1 text-xs leading-relaxed text-slate-600"><li v-for="note in proposal.notes" :key="note">{{ note }}</li></ul>
          
        </section>
      </template>
      
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" class="btn btn-secondary" :disabled="w.saving.value" @click="close">{{ calculating ? 'Batalkan' : 'Tutup' }}</button>
        <button v-if="mode === 'auto'" type="button" class="btn" :class="proposal ? 'btn-secondary' : 'btn-primary'" :disabled="disabled || calculating" @click="calculate">{{ calculating ? 'Menghitung…' : proposal ? 'Hitung ulang' : 'Susun jadwal' }}</button>
        <button v-if="mode !== 'auto' || proposal" class="btn btn-primary" :disabled="disabled || calculating || (mode === 'copy' && !copyFrom)">{{ mode === 'auto' ? 'Simpan draf' : 'Buat jadwal' }}</button>
      </div>
    </form>
  </AppModal>
</template>
