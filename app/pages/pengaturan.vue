<script setup lang="ts">
import { Save, Download, Upload, Building2, ShieldCheck, Database, SlidersHorizontal, UserPlus, Trash2 } from '@lucide/vue'
import type { Boundary, Member, Settings, Workspace } from '../domain/types'
import { parseWorkspace } from '../domain/schema'
import { prepareImportedDoctorPhotos } from '../domain/doctor-photo'
import { HOSPITAL_NAME, HOSPITAL_CITY } from '../domain/branding'
import { cloneWorkspace } from '../domain/commands'
import { planShifts } from '../domain/shifts'
import { downloadText } from '../services/exports'
import { daysInMonth } from '../domain/calendar'
import { monthLabel } from '../domain/calendar'
import { isScheduleReplacement, parseScheduleReplacement, replaceMonthSchedule, type ScheduleReplacement } from '../domain/schedule-replacement'
const w = useWorkspace(), { notify } = useNotifications()
const importPhotoResetCount = ref(0)
const tab = ref('facility'), form = ref<Settings | null>(null), frozen = ref(0), validationFrom = ref(1), boundaries = ref<Record<string, Boundary>>({})
const pendingImport = ref<Workspace | null>(null), fileInput = ref<HTMLInputElement | null>(null), members = ref<Member[]>([]), email = ref(''), memberBusy = ref(false)
const pendingSchedule = ref<ScheduleReplacement | null>(null)
function reset() {
  form.value = w.data.value ? JSON.parse(JSON.stringify(w.data.value.settings)) : null
  if (form.value) {
    form.value.hospital = HOSPITAL_NAME
    if (form.value.city === 'Kota Anda') form.value.city = HOSPITAL_CITY
    form.value.sectionHeadTitle ??= 'Kepala Seksi Pelayanan Medik'
    form.value.signatureOrder ??= 'director-first'
  }
  frozen.value = w.plan.value?.frozenThrough ?? 0; validationFrom.value = w.plan.value?.validationFrom ?? 1
  boundaries.value = JSON.parse(JSON.stringify(w.plan.value?.boundaries ?? {}))
  for (const d of w.data.value?.doctors ?? []) boundaries.value[d.id] ??= { prev2: '', prev1: '', next1: '', next2: '' }
}
watch([w.data, w.activeMonth], reset, { immediate: true })
watch(() => [w.id.value, w.session.value?.user.id ?? ''].join('|'), () => {
  pendingImport.value = null
  pendingSchedule.value = null
  importPhotoResetCount.value = 0
}, { flush: 'sync' })
const boundaryCodes = computed(() => w.data.value && w.plan.value ? planShifts(w.data.value, w.plan.value) : [])
async function saveSettings() { if (!form.value) return; const next = JSON.parse(JSON.stringify(form.value)); await w.mutate(data => { data.settings = next; return data }, 'Memperbarui fasilitas dan aturan penyusunan', true) }
async function savePeriod() {
  await w.mutate(data => {
    const p = data.plans[w.activeMonth.value]!
    if (p.locked) throw new Error('Buka kunci bulan sebelum mengubah periode.')
    p.frozenThrough = frozen.value; p.validationFrom = validationFrom.value
    p.boundaries = JSON.parse(JSON.stringify(boundaries.value)); return data
  }, `Memperbarui periode dan sambungan ${w.activeMonth.value}`, true)
}
function backup() { if (w.data.value) downloadText(JSON.stringify(w.data.value, null, 2), `Cadangan_RSUD_LEWOLEBA_${new Date().toISOString().slice(0, 10)}.json`) }
async function importFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('Ukuran berkas maksimal 2 MB.')
    const workspaceId = w.id.value, userId = w.session.value?.user.id
    const input: unknown = JSON.parse(await file.text())
    if (workspaceId !== w.id.value || userId !== w.session.value?.user.id) return
    if (isScheduleReplacement(input)) {
      if (!w.data.value) throw new Error('Data ruang kerja belum tersedia.')
      const packet = parseScheduleReplacement(input)
      replaceMonthSchedule(w.data.value, packet, w.role.value)
      pendingSchedule.value = packet
      pendingImport.value = null
      importPhotoResetCount.value = 0
    } else {
      const prepared = prepareImportedDoctorPhotos(parseWorkspace(input), workspaceId)
      pendingImport.value = prepared.data
      pendingSchedule.value = null
      importPhotoResetCount.value = prepared.removedPhotos
    }
  } catch (error) { notify((error as Error).message, true) }
  finally { if (fileInput.value) fileInput.value.value = '' }
}
async function confirmImport() {
  if (pendingSchedule.value) {
    const packet = pendingSchedule.value
    const ok = await w.mutate(data => replaceMonthSchedule(data, packet, w.role.value), `Mengganti jadwal ${packet.plan.month} dari ${packet.source.sheet}`, true)
    if (ok) { pendingSchedule.value = null; w.activeMonth.value = packet.plan.month }
    return
  }
  if (!pendingImport.value) return
  const next = pendingImport.value
  const ok = await w.mutate(() => cloneWorkspace(next), 'Mengimpor cadangan ruang kerja', true)
  if (ok) { pendingImport.value = null; w.activeMonth.value = Object.keys(next.plans).sort().at(-1) ?? '2026-10' }
}
async function loadMembers() { if (w.mode !== 'supabase') return; try { members.value = await w.getRepository()!.members(w.id.value) } catch (e) { notify((e as Error).message, true) } }
watch(tab, value => { if (value === 'access') loadMembers() })
async function addMember() { memberBusy.value = true; try { await w.getRepository()!.addMember(w.id.value, email.value, 'viewer'); email.value = ''; await loadMembers(); notify('Hak akses pengguna tersimpan.') } catch (e) { notify((e as Error).message, true) } finally { memberBusy.value = false } }
async function removeMember(userId: string) { memberBusy.value = true; try { await w.getRepository()!.removeMember(w.id.value, userId); await loadMembers(); notify('Akses pengguna dinonaktifkan.') } catch (e) { notify((e as Error).message, true) } finally { memberBusy.value = false } }
</script>
<template>
  <PageHeading title="Pengaturan ruang kerja" eyebrow="Administrasi"/>
  <div class="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3"><button v-for="t in [{ key: 'facility', label: 'Fasilitas & pengesahan', icon: Building2 }, { key: 'rules', label: 'Aturan & periode', icon: SlidersHorizontal }, { key: 'backup', label: 'Cadangan data', icon: Database }, { key: 'access', label: 'Hak akses', icon: ShieldCheck }]" :key="t.key" class="btn py-2 text-xs" :class="tab === t.key ? 'bg-brand-600 text-white' : 'btn-quiet'" :aria-pressed="tab === t.key" @click="tab = t.key"><component :is="t.icon" :size="15"/>{{ t.label }}</button></div>
  <section v-if="tab === 'facility' && form" class="panel max-w-3xl p-6"><form class="space-y-6" @submit.prevent="saveSettings"><fieldset :disabled="!w.isAdmin.value || w.saving.value"><h2 class="mb-5 text-sm font-semibold">Identitas fasilitas</h2><div class="grid gap-4 sm:grid-cols-2"><div class="sm:col-span-2"><label for="hospital" class="label">Nama rumah sakit</label><input id="hospital" v-model="form.hospital" class="field" required maxlength="180"/></div><div><label for="city" class="label">Kota pengesahan</label><input id="city" v-model="form.city" class="field" required/></div><div><label for="timezone" class="label">Zona waktu</label><select id="timezone" v-model="form.timezone" class="field"><option value="Asia/Jakarta">WIB</option><option value="Asia/Makassar">WITA</option><option value="Asia/Jayapura">WIT</option></select></div></div><h2 class="mt-8 mb-5 border-t border-slate-100 pt-6 text-sm font-semibold">Pengesahan jadwal</h2><div class="grid gap-4 sm:grid-cols-2"><div><label for="director" class="label">Nama direktur</label><input id="director" v-model="form.director" class="field"/></div><div><label for="director-nip" class="label">NIP direktur</label><input id="director-nip" v-model="form.directorNip" class="field" inputmode="numeric"/></div><div><label for="head" class="label">Nama pejabat pengesahan</label><input id="head" v-model="form.sectionHead" class="field"/></div><div><label for="head-nip" class="label">NIP pejabat pengesahan</label><input id="head-nip" v-model="form.sectionHeadNip" class="field" inputmode="numeric"/></div><div><label for="head-title" class="label">Jabatan pejabat pengesahan</label><input id="head-title" v-model="form.sectionHeadTitle" class="field" required maxlength="100"/></div><div><label for="signature-order" class="label">Urutan tanda tangan</label><select id="signature-order" v-model="form.signatureOrder" class="field"><option value="director-first">Direktur di kiri</option><option value="head-first">Pejabat pengesahan di kiri</option></select></div><div><label for="signed-date" class="label">Tanggal pengesahan</label><input id="signed-date" v-model="form.signedDate" class="field" type="date"/></div></div></fieldset><div class="flex justify-end"><button v-if="w.isAdmin.value" class="btn btn-primary" :disabled="w.saving.value"><Save :size="16"/>Simpan pengaturan</button></div></form></section>
  <div v-if="tab === 'rules' && form" class="space-y-6"><section class="panel max-w-3xl p-6"><form @submit.prevent="saveSettings"><h2 class="mb-2 text-sm font-semibold">Aturan penyusunan</h2><fieldset class="grid gap-4 sm:grid-cols-2" :disabled="!w.isAdmin.value || w.saving.value"><div><label for="gap" class="label">Jeda minimal antar dinas (jam)</label><input id="gap" v-model.number="form.minGapHours" class="field" type="number" min="0" max="48" required/></div><div><label for="long" class="label">Maksimal dinas panjang berurutan</label><input id="long" v-model.number="form.maxConsecutiveLong" class="field" type="number" min="1" max="2" required/></div><div><label for="off" class="label">Hari tanpa dinas setelah dua dinas panjang</label><input id="off" v-model.number="form.offAfterLong" class="field" type="number" min="1" max="7" required/></div><div><label for="streak" class="label">Maksimal tanggal kerja berurutan</label><input id="streak" v-model.number="form.maxConsecutiveWork" class="field" type="number" min="1" max="14" required/></div><div><label for="coverage" class="label">Minimal dokter per layanan & waktu</label><input id="coverage" v-model.number="form.minimumCoverage" class="field" type="number" min="1" max="10" required/></div></fieldset><button v-if="w.isAdmin.value" class="btn btn-primary mt-5" :disabled="w.saving.value">Simpan aturan</button></form></section>
    <section v-if="w.plan.value" class="panel p-6"><form @submit.prevent="savePeriod"><div class="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-sm font-semibold">Periode & sambungan bulan</h2></div><MonthSelect/></div><fieldset :disabled="!w.isAdmin.value || w.plan.value.locked || w.saving.value"><div class="mb-6 grid max-w-xl gap-4 sm:grid-cols-2"><div><label for="freeze" class="label">Kunci riwayat sampai tanggal</label><input id="freeze" v-model.number="frozen" class="field" type="number" min="0" :max="daysInMonth(w.activeMonth.value)" required/></div><div><label for="validation" class="label">Penyesuaian mulai tanggal</label><input id="validation" v-model.number="validationFrom" class="field" type="number" min="1" :max="daysInMonth(w.activeMonth.value)" required/></div></div><div class="scrollbar-thin overflow-x-auto"><table class="w-full text-xs"><thead class="table-head"><tr><th class="px-3 py-3">Dokter</th><th v-for="h in ['H−2 bulan lalu', 'H−1 bulan lalu', 'H+1 bulan depan', 'H+2 bulan depan']" :key="h" class="px-3 py-3">{{ h }}</th></tr></thead><tbody class="divide-y divide-slate-100"><tr v-for="d in w.data.value?.doctors.filter(d => d.active)" :key="d.id"><td class="whitespace-nowrap px-3 py-3 text-left font-medium">{{ d.name }}</td><td v-for="key in ['prev2', 'prev1', 'next1', 'next2'] as const" :key="key" class="min-w-30 px-2 py-2"><select v-if="boundaries[d.id]" v-model="boundaries[d.id]![key]" class="field py-2" :aria-label="`${d.name}, ${key}`"><option value="">Belum diketahui</option><option v-for="s in boundaryCodes" :key="s.code" :value="s.code">{{ s.code }}</option></select></td></tr></tbody></table></div></fieldset><button v-if="w.isAdmin.value" class="btn btn-primary mt-5" :disabled="w.plan.value.locked || w.saving.value">Simpan periode</button></form></section></div>
  <div v-if="tab === 'backup'" class="grid gap-5 lg:grid-cols-2"><section class="panel p-6"><Download class="mb-4 text-brand-600" :size="24"/><h2 class="text-sm font-semibold">Unduh cadangan</h2><button class="btn btn-secondary mt-5" :disabled="!w.data.value" @click="backup">Unduh cadangan JSON</button></section><section class="panel p-6"><Upload class="mb-4 text-brand-600" :size="24"/><h2 class="text-sm font-semibold">Impor data jadwal</h2><input ref="fileInput" class="sr-only" type="file" accept=".json,application/json" @change="importFile"/><button v-if="w.isAdmin.value" class="btn btn-primary mt-5" :disabled="w.saving.value" @click="fileInput?.click()">Pilih berkas JSON</button><p v-else class="mt-5 text-xs text-slate-600">Impor hanya tersedia untuk admin.</p></section><section class="panel p-6 lg:col-span-2"><h2 class="text-sm font-semibold">Riwayat perubahan</h2><div class="mt-4 max-h-72 overflow-y-auto"><p v-if="!w.data.value?.audit.length" class="text-xs text-slate-600">Belum ada perubahan.</p><div v-for="a in w.data.value?.audit.slice(0, 30)" :key="a.id" class="flex flex-col justify-between gap-1 border-b border-slate-100 py-3 sm:flex-row"><p class="text-xs font-medium">{{ a.action }}</p><p class="text-xs text-slate-600">{{ a.actor }} · {{ new Date(a.at).toLocaleString('id-ID') }}</p></div></div></section></div>
  <section v-if="tab === 'access'" class="panel max-w-4xl p-6">
    <h2 class="text-sm font-semibold">Hak akses pengguna</h2>
    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <div class="rounded-xl bg-slate-50 p-4"><p class="text-xs font-semibold">Administrator</p><p class="mt-2 text-xs leading-relaxed text-slate-600">Satu akun untuk mengelola jadwal, dokter, jam dinas, portal, dan pengguna.</p></div>
      <div class="rounded-xl bg-slate-50 p-4"><p class="text-xs font-semibold">Pembaca</p><p class="mt-2 text-xs leading-relaxed text-slate-600">Melihat jadwal dan rekap, mencetak, serta mencatat absensi sendiri.</p></div>
    </div>
    <template v-if="w.mode === 'supabase' && w.isAdmin.value">
      <form class="mt-6 flex flex-wrap items-end gap-3" @submit.prevent="addMember">
        <div class="min-w-48 flex-1"><label for="member-email" class="label">Email akun</label><input id="member-email" v-model="email" type="email" class="field" required /></div>
        <button class="btn btn-primary" :disabled="memberBusy"><UserPlus :size="15" />Aktifkan akses pembaca</button>
      </form>
      <div class="mt-5 divide-y divide-slate-100">
        <div v-for="m in members" :key="m.userId" class="flex items-center justify-between gap-3 py-3">
          <div><p class="text-xs font-semibold">{{ m.email }}</p><p class="mt-1 text-xs text-slate-600">{{ m.role === 'admin' ? 'Administrator' : 'Pembaca' }}</p></div>
          <button v-if="m.role !== 'admin'" class="btn btn-quiet p-2" :disabled="memberBusy" :aria-label="`Nonaktifkan akses ${m.email}`" @click="removeMember(m.userId)"><Trash2 :size="15" /></button>
        </div>
      </div>
    </template>
  </section>
  <AppModal v-if="pendingSchedule" title="Ganti jadwal bulan ini?" @close="pendingSchedule = null">
    <p class="text-sm text-slate-600">{{ monthLabel(pendingSchedule.plan.month) }} · {{ pendingSchedule.source.file }} · {{ pendingSchedule.source.sheet }}</p>
    <div class="mt-4 divide-y divide-slate-100">
      <div v-for="doctor in pendingSchedule.doctors" :key="doctor.id" class="flex justify-between gap-3 py-2 text-xs">
        <span>{{ doctor.name }}</span><span class="font-semibold tabular-nums">{{ pendingSchedule.expectedHours[doctor.id] }} jam</span>
      </div>
    </div>
    <p class="mt-4 text-xs leading-relaxed text-slate-600">Mengganti seluruh isian bulan ini, nama dan nomor HP dokter, cuti pada bulan ini, jam dinas, keterangan cetak, serta pengesahan. Foto dokter dan jadwal bulan lain tetap tersimpan. Jadwal dibuka untuk pemeriksaan.</p>
    <div class="mt-6 flex justify-end gap-2">
      <button class="btn btn-secondary" :disabled="w.saving.value" @click="pendingSchedule = null">Batal</button>
      <button class="btn btn-primary" :disabled="w.saving.value" @click="confirmImport">Ganti jadwal</button>
    </div>
  </AppModal>
  <AppModal v-if="pendingImport" title="Ganti isi ruang kerja dengan berkas ini?" @close="pendingImport = null"><p class="text-sm leading-relaxed text-slate-600">{{ pendingImport.settings.hospital }} · {{ pendingImport.doctors.length }} dokter · {{ Object.keys(pendingImport.plans).length }} bulan jadwal.</p><p v-if="importPhotoResetCount" class="mt-4 rounded-xl bg-brand-50 p-4 text-xs leading-relaxed text-brand-800">{{ importPhotoResetCount }} foto tidak ikut diimpor karena berasal dari fasilitas berbeda.</p><p class="mt-4 rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">Impor akan mengganti data jadwal saat ini.</p><div class="mt-6 flex justify-end gap-2"><button class="btn btn-secondary" @click="pendingImport = null">Batal</button><button class="btn btn-primary" :disabled="w.saving.value" @click="confirmImport">Impor data</button></div></AppModal>
</template>
