<script setup lang="ts">
import { CalendarDays, MapPin, ShieldCheck, Eye, EyeOff } from '@lucide/vue'
import { safePrivateReturn } from '../domain/auth-routing'
definePageMeta({ layout: 'public' })
const db = useNuxtApp().$db, w = useWorkspace(), route = useRoute(), { notify } = useNotifications()
const registering = ref(false), email = ref(''), password = ref(''), visible = ref(false), busy = ref(false), message = ref('')
useSeoMeta({ title: 'Masuk · Ruang Dinas', robots: 'noindex, nofollow' })
async function submit() {
  if (!db || busy.value) return
  busy.value = true; message.value = ''
  try {
    const target = safePrivateReturn(route.query.returnTo)
    if (registering.value) {
      const redirect = new URL('/masuk', window.location.origin)
      redirect.searchParams.set('returnTo', target)
      const { error } = await db.auth.signUp({ email: email.value.trim(), password: password.value, options: { emailRedirectTo: redirect.toString() } })
      if (error) throw error
      message.value = 'Akun terdaftar. Verifikasi email, lalu minta admin rumah sakit menambahkan akses Anda.'
    } else {
      const { data, error } = await db.auth.signInWithPassword({ email: email.value.trim(), password: password.value })
      if (error) throw error
      await w.initialize(db, data.session)
      await navigateTo(w.needsWorkspace.value ? { path: '/mulai', query: { returnTo: target } } : target)
    }
  } catch (error) { notify((error as Error).message, true) }
  finally { busy.value = false }
}
</script>
<template>
  <div class="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:px-8 lg:py-16">
    <section class="app-hero relative overflow-hidden rounded-[2rem] p-7 sm:p-10">
      <p class="eyebrow text-brand-700">RUANG KERJA TIM RUMAH SAKIT</p>
      <h1 class="mt-5 max-w-md text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">Pelayanan yang tertata dimulai dari tim yang terhubung.</h1>
      <p class="mt-5 max-w-md text-sm leading-relaxed text-slate-600">Kelola jadwal dokter, pemerataan jam, foto tim, dan absensi melalui akun fasilitas.</p>
      <div class="mt-8 space-y-4"><div v-for="item in [{ icon: CalendarDays, title: 'Jadwal dalam satu ruang kerja', text: 'Lihat dan kelola dinas sesuai peran Anda.' }, { icon: MapPin, title: 'Absensi di sekitar rumah sakit', text: 'QR bersama dengan pemeriksaan lokasi perangkat.' }, { icon: ShieldCheck, title: 'Akses yang terkelola', text: 'Akun baru menunggu persetujuan admin fasilitas.' }]" :key="item.title" class="flex items-start gap-4 rounded-2xl border border-white bg-white/80 p-4"><span class="rounded-xl bg-brand-100 p-2.5 text-brand-700"><component :is="item.icon" :size="18" /></span><div><h2 class="text-sm font-semibold">{{ item.title }}</h2><p class="mt-1 text-xs leading-relaxed text-slate-600">{{ item.text }}</p></div></div></div>
      <NuxtLink to="/" class="mt-7 inline-block text-sm font-semibold text-brand-800">Kembali ke informasi publik</NuxtLink>
    </section>
    <section class="panel p-6 sm:p-8">
      <p class="eyebrow text-brand-700">{{ registering ? 'PENDAFTARAN AKUN' : 'MASUK AKUN' }}</p>
      <h2 class="mt-3 text-2xl font-semibold tracking-tight">{{ registering ? 'Buat akun tim' : 'Masuk ke ruang kerja' }}</h2>
      <p class="mt-3 text-sm leading-relaxed text-slate-600">{{ registering ? 'Gunakan email yang akan ditambahkan oleh admin rumah sakit.' : 'Informasi publik tetap dapat dibaca tanpa akun. Masuk untuk membuka fitur tim.' }}</p>
      <p v-if="!db" class="mt-5 rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">Akses akun fasilitas sedang disiapkan. Informasi publik tetap bisa dibaca melalui Beranda.</p>
      <p v-if="w.error.value" class="mt-5 rounded-xl bg-rose-50 p-4 text-xs leading-relaxed text-rose-700" role="alert">{{ w.error.value }}</p>
      <form class="mt-7 space-y-5" @submit.prevent="submit">
        <div><label for="email" class="label">Email</label><input id="email" v-model="email" type="email" class="field" autocomplete="email" required placeholder="nama@rumahsakit.id" /></div>
        <div><label for="password" class="label">Kata sandi</label><div class="relative"><input id="password" v-model="password" :type="visible ? 'text' : 'password'" class="field pr-12" :autocomplete="registering ? 'new-password' : 'current-password'" :minlength="registering ? 10 : 1" required /><button type="button" class="absolute top-1 right-1 rounded-lg p-2.5 text-slate-500" :aria-label="visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'" @click="visible = !visible"><component :is="visible ? EyeOff : Eye" :size="17" /></button></div></div>
        <p v-if="message" class="rounded-xl bg-brand-50 p-4 text-xs leading-relaxed text-brand-800" role="status">{{ message }}</p>
        <button class="btn btn-primary w-full" :disabled="busy || !db">{{ busy ? 'Memproses…' : registering ? 'Daftar akun' : 'Masuk' }}</button>
      </form>
      <p class="mt-6 text-center text-xs text-slate-600">{{ registering ? 'Sudah memiliki akun?' : 'Belum memiliki akun?' }} <button class="font-semibold text-brand-700" :disabled="busy" @click="registering = !registering; message = ''">{{ registering ? 'Masuk' : 'Daftar akun' }}</button></p>
      <p class="mt-6 border-t border-slate-100 pt-5 text-center text-[11px] leading-relaxed text-slate-500">Admin menentukan akses ke rumah sakit dan menghubungkan akun dengan nama dokter.</p>
    </section>
  </div>
</template>
