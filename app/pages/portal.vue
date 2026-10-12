<script setup lang="ts">
import { Globe, MapPin, Plus, Save, Send, RefreshCw, Copy, ExternalLink } from '@lucide/vue'
import type { PortalDraft } from '../domain/hospital-portal'
import { emptyPortalDraft } from '../domain/hospital-portal'
import { requestGeolocation } from '../services/geolocation'
import { attendanceDate } from '../domain/attendance'
import { monthLabel, prettyDate } from '../domain/calendar'
const w = useWorkspace(), p = useHospitalPortal(), route = useRoute(), { notify } = useNotifications()
const tab = ref(route.query.tab === 'location' ? 'location' : 'public')
const form = ref<PortalDraft>(emptyPortalDraft()), withdrawing = ref(false), locating = ref(false)
const geo = ref<{ latitude: number | null; longitude: number | null; radius_meters: number; max_accuracy_meters: number }>({ latitude: null, longitude: null, radius_meters: 300, max_accuracy_meters: 150 })
const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(p.draft.value))
const lockedMonths = computed(() => w.months.value.filter(month => w.data.value?.plans[month]?.locked))
const services = computed({ get: () => form.value.services.join('\n'), set: (text: string) => { form.value.services = text.split('\n').map(s => s.trim()).filter(Boolean) } })
const mapUrl = computed(() => typeof geo.value.latitude === 'number' && typeof geo.value.longitude === 'number'
  ? 'https://www.google.com/maps?q=' + geo.value.latitude + ',' + geo.value.longitude : '')
let locationRequest = 0
watch(p.draft, data => { form.value = JSON.parse(JSON.stringify(data)) }, { immediate: true })
watch(p.location, data => {
  geo.value = data ? { latitude: data.latitude, longitude: data.longitude, radius_meters: data.radius_meters, max_accuracy_meters: data.max_accuracy_meters }
    : { latitude: null, longitude: null, radius_meters: 300, max_accuracy_meters: 150 }
}, { immediate: true })
watch(() => [w.id.value, w.session.value?.user.id ?? ''].join('|'), () => { locationRequest++; locating.value = false; withdrawing.value = false }, { flush: 'sync' })
onBeforeUnmount(() => { locationRequest++ })
function addNews() {
  if (form.value.news.length >= 30) { notify('Maksimal 30 berita dalam publikasi ini.', true); return }
  form.value.news.unshift({ id: crypto.randomUUID(), title: '', summary: '', content: '', date: attendanceDate(new Date(), w.data.value?.settings.timezone || 'Asia/Makassar'), published: false })
}
async function saveDraft() { await p.save(form.value) }
async function withdraw() { if (await p.unpublish()) withdrawing.value = false }
async function copyId() {
  try { await navigator.clipboard.writeText(w.id.value); notify('ID rumah sakit disalin.') }
  catch { notify('Salin ID rumah sakit dari kolom yang ditampilkan.', true) }
}
async function useMyLocation() {
  if (locating.value || p.busy.value) return
  const request = ++locationRequest, id = w.id.value, user = w.session.value?.user.id
  locating.value = true
  try {
    const reading = await requestGeolocation()
    if (request !== locationRequest || id !== w.id.value || user !== w.session.value?.user.id) return
    geo.value.latitude = reading.latitude; geo.value.longitude = reading.longitude
    notify('Titik perangkat dimasukkan. Periksa pada peta sebelum menyimpannya sebagai titik rumah sakit.')
  } catch (error) { if (request === locationRequest) notify((error as Error).message, true) }
  finally { if (request === locationRequest) locating.value = false }
}
async function saveGeo() {
  if (typeof geo.value.latitude !== 'number' || typeof geo.value.longitude !== 'number') { notify('Isi koordinat titik rumah sakit terlebih dahulu.', true); return }
  await p.saveLocation({ ...geo.value, latitude: geo.value.latitude, longitude: geo.value.longitude })
}
</script>
<template>
  <PageHeading title="Portal publik & lokasi RS" eyebrow="Administrasi">
    <NuxtLink to="/" class="btn btn-secondary"><Globe :size="15" />Lihat portal</NuxtLink>
    <button v-if="w.isAdmin.value" class="btn btn-secondary" :disabled="p.busy.value || p.loading.value" @click="p.load()"><RefreshCw :size="15" />Muat ulang</button>
  </PageHeading>
  <section v-if="!w.isAdmin.value" class="panel p-8 text-sm text-slate-600">Akses administrator diperlukan.</section>
  <template v-else>
    <div class="mb-6 flex gap-2 border-b border-brand-100 pb-3"><button class="btn" :class="tab === 'public' ? 'btn-primary' : 'btn-secondary'" @click="tab = 'public'"><Globe :size="15" />Informasi publik</button><button class="btn" :class="tab === 'location' ? 'btn-primary' : 'btn-secondary'" @click="tab = 'location'"><MapPin :size="15" />Lokasi absensi</button></div>
    <p v-if="p.loading.value" class="panel p-7 text-sm text-slate-600">Memuat pengaturan…</p>
    <p v-else-if="p.error.value" class="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm leading-relaxed text-rose-700" role="alert">{{ p.error.value }}</p>
    <template v-else>
      <div v-if="tab === 'public'" class="space-y-6">
        <section class="app-hero rounded-2xl p-6"><h2 class="text-lg font-semibold">Publikasi</h2><p class="mt-4 text-xs font-medium text-brand-800">{{ p.publishedAt.value ? 'Publikasi terakhir: ' + new Date(p.publishedAt.value).toLocaleString('id-ID', { timeZone: w.data.value?.settings.timezone || 'Asia/Makassar' }) : 'Belum ada informasi yang diterbitkan.' }}</p></section>
        <form class="space-y-6" @submit.prevent="saveDraft">
          <section class="panel p-6"><fieldset class="space-y-5" :disabled="p.busy.value"><h2 class="text-lg font-semibold">Profil dan kontak publik</h2><div><label for="public-about" class="label">Tentang rumah sakit</label><textarea id="public-about" v-model="form.about" class="field min-h-28" maxlength="4000" /></div><div><label for="public-address" class="label">Alamat untuk masyarakat</label><textarea id="public-address" v-model="form.address" class="field min-h-20" maxlength="500" /></div><div class="grid gap-4 sm:grid-cols-2"><div><label for="public-phone" class="label">Nomor kontak rumah sakit</label><input id="public-phone" v-model="form.phone" class="field" maxlength="40" inputmode="tel" /></div><div><label for="public-email" class="label">Email informasi publik</label><input id="public-email" v-model="form.email" class="field" type="email" maxlength="180" /></div></div><div><label for="public-services" class="label">Layanan (satu per baris)</label><textarea id="public-services" v-model="services" class="field min-h-28" /></div><div><label for="public-month" class="label">Bulan jadwal yang diterbitkan</label><select id="public-month" v-model="form.scheduleMonth" class="field"><option :value="null">Belum menampilkan jadwal</option><option v-for="month in lockedMonths" :key="month" :value="month">{{ monthLabel(month) }}</option></select></div></fieldset></section>
          <section class="panel p-6"><div class="flex items-center justify-between gap-3"><h2 class="text-lg font-semibold">Berita & pengumuman</h2><button type="button" class="btn btn-secondary" :disabled="p.busy.value" @click="addNews"><Plus :size="15" />Tambah berita</button></div><p v-if="!form.news.length" class="mt-5 text-sm text-slate-600">Belum ada berita.</p><fieldset v-for="(article, i) in form.news" :key="article.id" class="mt-6 space-y-4 rounded-2xl border border-brand-100 bg-brand-50/30 p-5" :disabled="p.busy.value"><div class="flex items-center justify-between"><p class="text-sm font-semibold">Berita {{ i + 1 }}</p><button type="button" class="text-xs font-medium text-rose-700" @click="form.news.splice(i, 1)">Hapus dari draf</button></div><div><label :for="'news-title-' + i" class="label">Judul</label><input :id="'news-title-' + i" v-model="article.title" class="field" required maxlength="160" /></div><div><label :for="'news-summary-' + i" class="label">Ringkasan</label><textarea :id="'news-summary-' + i" v-model="article.summary" class="field min-h-20" maxlength="400" /></div><div><label :for="'news-content-' + i" class="label">Isi berita</label><textarea :id="'news-content-' + i" v-model="article.content" class="field min-h-48" required maxlength="12000" /></div><div class="grid gap-4 sm:grid-cols-2"><div><label :for="'news-date-' + i" class="label">Tanggal berita</label><input :id="'news-date-' + i" v-model="article.date" type="date" class="field" required /></div><label class="flex items-center gap-2 text-sm text-slate-600"><input v-model="article.published" type="checkbox" />Tampilkan saat portal diterbitkan</label></div></fieldset></section>
          <div class="flex flex-wrap justify-end gap-3"><button class="btn btn-secondary" :disabled="p.busy.value"><Save :size="15" />Simpan draf</button><button type="button" class="btn btn-primary" :disabled="p.busy.value || dirty || !p.revision.value" @click="p.publish()"><Send :size="15" />Terbitkan informasi</button><button v-if="p.publishedAt.value" type="button" class="btn btn-secondary" :disabled="p.busy.value" @click="withdrawing = true">Tarik publikasi</button></div><p v-if="dirty" class="text-right text-xs text-amber-700">Simpan perubahan draf sebelum menerbitkan.</p>
        </form>
        <section class="panel p-6"><h2 class="font-semibold">ID fasilitas</h2><div class="mt-4 flex flex-col gap-3 sm:flex-row"><input :value="w.id.value" readonly class="field" aria-label="ID fasilitas" /><button class="btn btn-secondary shrink-0" @click="copyId"><Copy :size="15" />Salin ID</button></div></section>
      </div>
      <section v-else class="panel max-w-3xl p-6 sm:p-8">
        <h2 class="text-xl font-semibold">Titik acuan dan radius rumah sakit</h2>
        <form class="mt-6 space-y-5" @submit.prevent="saveGeo"><fieldset class="space-y-5" :disabled="p.busy.value || locating"><div class="grid gap-4 sm:grid-cols-2"><div><label for="hospital-lat" class="label">Latitude</label><input id="hospital-lat" v-model.number="geo.latitude" class="field" type="number" step="any" min="-90" max="90" required /></div><div><label for="hospital-lng" class="label">Longitude</label><input id="hospital-lng" v-model.number="geo.longitude" class="field" type="number" step="any" min="-180" max="180" required /></div></div><div class="flex flex-wrap gap-3"><button type="button" class="btn btn-secondary" @click="useMyLocation"><MapPin :size="15" />{{ locating ? 'Memeriksa GPS…' : 'Gunakan lokasi perangkat ini' }}</button><a v-if="mapUrl" :href="mapUrl" target="_blank" rel="noopener noreferrer" class="btn btn-secondary"><ExternalLink :size="15" />Periksa titik pada peta</a></div><div class="grid gap-4 sm:grid-cols-2"><div><label for="hospital-radius" class="label">Radius absensi (meter)</label><input id="hospital-radius" v-model.number="geo.radius_meters" class="field" type="number" min="50" max="2000" required /></div><div><label for="hospital-accuracy" class="label">Batas akurasi GPS (meter)</label><input id="hospital-accuracy" v-model.number="geo.max_accuracy_meters" class="field" type="number" min="10" max="500" required /></div></div><button class="btn btn-primary"><Save :size="15" />Simpan lokasi absensi</button></fieldset></form>
        <p v-if="p.location.value" class="mt-5 text-xs text-slate-600">Lokasi absensi aktif.</p>
        <NuxtLink to="/absen" class="mt-5 inline-block text-sm font-semibold text-brand-700">Buka absensi dan cetak QR</NuxtLink>
      </section>
    </template>
  </template>
  <AppModal v-if="withdrawing" title="Tarik informasi dari portal publik?" @close="!p.busy.value && (withdrawing = false)"><p class="text-sm leading-relaxed text-slate-600">Informasi publik akan ditarik. Draf tetap tersimpan.</p><div class="mt-6 flex justify-end gap-2"><button class="btn btn-secondary" :disabled="p.busy.value" @click="withdrawing = false">Batal</button><button class="btn btn-primary" :disabled="p.busy.value" @click="withdraw">Tarik publikasi</button></div></AppModal>
</template>
