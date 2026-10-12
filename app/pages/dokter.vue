<script setup lang="ts">
import { Plus, Search, UsersRound, ImagePlus, Trash2 } from '@lucide/vue'
import type { Doctor } from '../domain/types'
import { DOCTOR_ROSTER, applyDoctorRoster, initialRosterChoices, orderedDoctors } from '../domain/doctor-roster'

const w = useWorkspace(), photos = useDoctorPhotos()
const edit = ref<Doctor | null>(null), query = ref(''), status = ref('active'), unit = ref('')
const rosterModal = ref(false), choices = ref<string[]>([])
const photoInput = ref<HTMLInputElement | null>(null), previewFailed = ref(false)
const editorBusy = computed(() => w.saving.value || photos.busy.value)
const summaries = computed(() => new Map(w.summaries.value.map(r => [r.doctor.id, r])))
const rows = computed(() => orderedDoctors(w.data.value?.doctors ?? []).map((doctor, i) => ({ doctor, number: i + 1 })).filter(({ doctor }) =>
  doctor.name.toLowerCase().includes(query.value.toLowerCase().trim()) && (!unit.value || doctor.unit === unit.value) && (status.value === 'all' || doctor.active === (status.value === 'active'))))
const activeCount = computed(() => w.data.value?.doctors.filter(d => d.active).length ?? 0)

function open(d?: Doctor) {
  if (editorBusy.value) return
  const doctor: Doctor = d ? JSON.parse(JSON.stringify(d)) : {
    id: crypto.randomUUID(), name: '', phone: '', photoPath: null, unit: 'rotasi', active: true, joinedOn: null, leave: [],
  }
  photos.begin(doctor)
  edit.value = doctor
}

function closeEditor() {
  if (editorBusy.value) return
  photos.clear()
  edit.value = null
}

function selectPhoto(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  input.value = ''
  if (file) void photos.select(file)
}

async function submit() {
  if (!edit.value || editorBusy.value) return
  const doctor = { ...edit.value, name: edit.value.name.trim(), joinedOn: edit.value.joinedOn || null }
  if (await photos.save(doctor)) closeEditor()
}

function openRoster() { choices.value = initialRosterChoices(w.data.value?.doctors ?? []); rosterModal.value = true }
async function syncRoster() {
  const selected = [...choices.value]
  if (await w.mutate(data => applyDoctorRoster(data, selected, w.role.value), 'Menyesuaikan nama dan urutan sembilan dokter', true)) {
    rosterModal.value = false
    status.value = 'active'
  }
}

watch(() => photos.previewUrl.value, () => { previewFailed.value = false })
watch(() => [w.id.value, w.session.value?.user.id ?? '', w.role.value].join('|'), () => {
  edit.value = null
  rosterModal.value = false
  photos.clear()
}, { flush: 'sync' })
</script>

<template>
  <PageHeading title="Tim dokter" eyebrow="Tim pelayanan">
    <MonthSelect />
    <button v-if="w.isAdmin.value" class="btn btn-primary" :disabled="editorBusy" @click="open()"><Plus :size="16" />Tambah dokter</button>
  </PageHeading>

  <section class="app-hero mb-6 flex flex-col justify-between gap-6 rounded-[1.5rem] p-6 text-ink sm:flex-row sm:items-center sm:p-8">
    <div>
      <p class="text-xs font-medium tracking-widest text-brand-700">TIM PELAYANAN MEDIK</p>
      <h2 class="mt-3 text-2xl font-semibold tracking-tight">{{ activeCount }} dokter aktif</h2>
      
    </div>
    <button v-if="w.isAdmin.value" class="btn btn-lime shrink-0" :disabled="editorBusy" @click="openRoster"><UsersRound :size="16" />Sesuaikan 9 dokter</button>
  </section>

  <div class="mb-6 flex flex-col gap-3 sm:flex-row">
    <div class="relative flex-1"><Search class="absolute top-3.5 left-3.5 text-slate-600" :size="16" /><input v-model="query" class="field pl-10" aria-label="Cari nama dokter" /></div>
    <select v-model="unit" class="field sm:w-44" aria-label="Filter layanan"><option value="">Semua layanan</option><option value="rotasi">Rotasi layanan</option><option value="anak">Ruang anak</option></select>
    <select v-model="status" class="field sm:w-40" aria-label="Filter status dokter"><option value="active">Dokter aktif</option><option value="inactive">Nonaktif</option><option value="all">Semua status</option></select>
  </div>

  <div v-if="photos.loadError.value" class="mb-5 flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center" role="status">
    <p class="text-xs leading-relaxed text-amber-800">{{ photos.loadError.value }}</p>
    <button class="btn btn-secondary shrink-0" :disabled="photos.loading.value" @click="photos.refresh()">Muat ulang foto</button>
  </div>
  <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
    <DoctorCard v-for="row in rows" :key="row.doctor.id" :doctor="row.doctor" :number="row.number" :summary="summaries.get(row.doctor.id)" :photo-url="photos.urls.value[row.doctor.id]" :can-edit="w.isAdmin.value && !editorBusy" @edit="open" />
  </div>
  <div v-if="!rows.length" class="panel p-10 text-center text-sm text-slate-600">Tidak ada dokter yang sesuai pencarian.</div>
  

  <AppModal v-if="rosterModal" title="Sesuaikan sembilan dokter" wide @close="!w.saving.value && (rosterModal = false)">
    <form class="space-y-5" @submit.prevent="syncRoster">
      
      <div class="space-y-3">
        <div v-for="(d, i) in DOCTOR_ROSTER" :key="d.name" class="grid items-center gap-2 sm:grid-cols-[120px_1fr]">
          <label :for="'roster-' + i" class="text-sm font-medium">{{ i + 1 }}. {{ d.name }}</label>
          <select :id="'roster-' + i" v-model="choices[i]" class="field" :disabled="w.saving.value"><option value="">Buat dokter baru</option><option v-for="old in w.data.value?.doctors" :key="old.id" :value="old.id">{{ old.name }}</option></select>
        </div>
      </div>
      <p class="rounded-xl bg-brand-50 p-4 text-xs leading-relaxed text-brand-800">Dokter yang tidak dipilih akan dinonaktifkan. Riwayat tetap tersimpan.</p>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" :disabled="w.saving.value" @click="rosterModal = false">Batal</button><button class="btn btn-primary" :disabled="w.saving.value">Terapkan daftar</button></div>
    </form>
  </AppModal>

  <AppModal v-if="edit" title="Data dokter" @close="closeEditor">
    <form @submit.prevent="submit">
      <fieldset class="space-y-4" :disabled="editorBusy || !w.isAdmin.value">
        <section class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p class="label">Foto dokter</p>
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div class="doctor-poster relative flex aspect-[4/5] w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl text-brand-700">
              <img v-if="photos.previewUrl.value && !previewFailed" :src="photos.previewUrl.value" :alt="'Pratinjau foto ' + (edit.name || 'dokter')" class="h-full w-full object-cover" @error="previewFailed = true" />
              <span v-else class="text-3xl font-medium">{{ edit.name.replace(/^dr\.?\s*/i, '').slice(0, 2).toUpperCase() || 'DR' }}</span>
            </div>
            <div class="min-w-0 flex-1">
              
              
              
              <input ref="photoInput" class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Pilih foto dokter" :disabled="!photos.canUpload.value" @change="selectPhoto" />
              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" class="btn btn-secondary" :disabled="!photos.canUpload.value" @click="photoInput?.click()"><ImagePlus :size="14" />{{ photos.hasPhoto.value ? 'Ganti foto' : 'Pilih foto' }}</button>
                <button v-if="photos.hasPhoto.value" type="button" class="btn btn-secondary" @click="photos.remove()"><Trash2 :size="14" />Lepas foto</button>
              </div>
              <p v-if="photos.busy.value" class="mt-3 text-xs text-brand-700" role="status">Memproses dan menyimpan data…</p>
              <p v-if="previewFailed" class="mt-3 text-xs text-amber-700">Foto belum dapat ditampilkan.</p>
            </div>
          </div>
          <p v-if="photos.error.value" class="mt-3 text-xs leading-relaxed text-red-700" role="alert">{{ photos.error.value }}</p>
        </section>

        <div><label for="doctor-name" class="label">Nama dokter</label><input id="doctor-name" v-model="edit.name" class="field" required maxlength="100" /></div>
        <div><label for="doctor-phone" class="label">Nomor HP (opsional)</label><input id="doctor-phone" v-model="edit.phone" class="field" inputmode="tel" maxlength="30" /></div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div><label for="doctor-unit" class="label">Layanan</label><select id="doctor-unit" v-model="edit.unit" class="field"><option value="rotasi">Rotasi layanan</option><option value="anak">Ruang anak saja</option></select></div>
          <div><label for="doctor-joined" class="label">Mulai bergabung</label><input id="doctor-joined" v-model="edit.joinedOn" type="date" class="field" /></div>
        </div>
        <div>
          <div class="mb-3 flex items-center justify-between"><p class="label mb-0">Periode cuti</p><button type="button" class="text-xs font-semibold text-brand-700" @click="edit.leave.push({ from: '', to: '' })">Tambah periode</button></div>
          <div v-for="(l, i) in edit.leave" :key="i" class="mb-2 grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <input v-model="l.from" class="field" type="date" required :aria-label="'Mulai cuti ' + (i + 1)" />
            <input v-model="l.to" class="field" type="date" required :min="l.from" :aria-label="'Selesai cuti ' + (i + 1)" />
            <button type="button" class="p-1 text-xs text-slate-600" aria-label="Hapus periode cuti" @click="edit.leave.splice(i, 1)">Hapus</button>
          </div>
          <p v-if="!edit.leave.length" class="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Belum ada cuti.</p>
        </div>
        <label class="flex items-center gap-2 text-xs text-slate-600"><input v-model="edit.active" type="checkbox" />Dokter aktif untuk jadwal baru</label>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-secondary" @click="closeEditor">Batal</button>
          <button class="btn btn-primary">{{ editorBusy ? 'Menyimpan…' : 'Simpan dokter' }}</button>
        </div>
      </fieldset>
    </form>
  </AppModal>
</template>
