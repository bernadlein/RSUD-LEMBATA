<script setup lang="ts">
import { ArrowRight, ShieldCheck, CalendarDays, Clock3 } from '@lucide/vue'
definePageMeta({ layout: false })
const db = useNuxtApp().$db, w = useWorkspace(), { notify } = useNotifications()
const registering = ref(false), email = ref(''), password = ref(''), busy = ref(false), message = ref('')
async function submit() {
  if (!db) { notify('Konfigurasi Supabase belum lengkap.', true); return }
  busy.value = true; message.value = ''
  try {
    if (registering.value) {
      const { error } = await db.auth.signUp({ email: email.value.trim(), password: password.value, options: { emailRedirectTo: `${window.location.origin}/masuk` } })
      if (error) throw error
      message.value = 'Akun terdaftar. Periksa email untuk verifikasi, kemudian masuk.'
    } else {
      const { data, error } = await db.auth.signInWithPassword({ email: email.value.trim(), password: password.value })
      if (error) throw error
      await w.initialize(db, data.session)
      await navigateTo(w.needsWorkspace.value ? '/mulai' : '/')
    }
  } catch (e) { notify((e as Error).message, true) }
  finally { busy.value = false }
}
</script>
<template><main class="grid min-h-dvh lg:grid-cols-2"><section class="relative hidden overflow-hidden bg-brand-800 p-14 text-white lg:flex lg:flex-col"><NuxtLink to="/" class="flex items-center gap-3 text-xl font-bold"><img src="/favicon.svg" alt="" class="h-10 w-10"/>Ruang Dinas.</NuxtLink><div class="relative z-1 my-auto max-w-md"><p class="mb-5 text-xs font-semibold tracking-[0.14em] text-lime-soft uppercase">Untuk tim pelayanan</p><h1 class="text-4xl leading-tight font-semibold tracking-tight">Jadwal yang jelas.<br/>Jam kerja yang terukur.</h1><p class="mt-6 text-sm leading-relaxed text-brand-100/75">Susun dinas, periksa pola, dan lihat jam kerja setiap dokter dalam satu ruang kerja.</p><div class="mt-9 space-y-4"><p v-for="item in [{ icon: CalendarDays, label: 'Jadwal bulanan yang mudah diisi' }, { icon: Clock3, label: 'Durasi dihitung dari kode dinas' }, { icon: ShieldCheck, label: 'Hak akses sesuai peran pengguna' }]" :key="item.label" class="flex items-center gap-3 text-xs text-brand-100"><component :is="item.icon" :size="18" class="text-lime-soft"/>{{ item.label }}</p></div></div><p class="relative z-1 text-xs text-brand-100/50">Ruang Dinas · Manajemen jadwal dokter</p><div class="absolute -right-40 -bottom-40 h-[650px] w-[650px] rounded-full border-[80px] border-white/4"/></section><section class="flex items-center justify-center px-6 py-12"><div class="w-full max-w-sm"><img src="/favicon.svg" alt="Ruang Dinas" class="mb-8 h-12 w-12 lg:hidden"/><h2 class="text-2xl font-semibold tracking-tight">{{ registering ? 'Daftar akun' : 'Masuk ke ruang kerja' }}</h2><p class="mt-3 text-sm leading-relaxed text-slate-500">{{ registering ? 'Gunakan email yang akan ditambahkan oleh admin rumah sakit.' : 'Gunakan akun yang memiliki akses ke jadwal rumah sakit.' }}</p><div v-if="w.error.value" class="mt-5 rounded-xl bg-rose-50 p-4 text-xs leading-relaxed text-rose-700">{{ w.error.value }}</div><form class="mt-8 space-y-5" @submit.prevent="submit"><div><label for="email" class="label">Email</label><input id="email" v-model="email" type="email" class="field" autocomplete="email" required placeholder="nama@rumahsakit.id"/></div><div><label for="password" class="label">Kata sandi</label><input id="password" v-model="password" type="password" class="field" :autocomplete="registering ? 'new-password' : 'current-password'" :minlength="registering ? 10 : 1" required/></div><p v-if="message" class="rounded-xl bg-brand-50 p-4 text-xs leading-relaxed text-brand-800" role="status">{{ message }}</p><button class="btn btn-primary w-full" :disabled="busy || !db">{{ busy ? 'Memproses…' : registering ? 'Daftar' : 'Masuk' }}<ArrowRight :size="16"/></button></form><p class="mt-6 text-center text-xs text-slate-400">{{ registering ? 'Sudah memiliki akun?' : 'Belum memiliki akun?' }} <button class="font-semibold text-brand-700" @click="registering = !registering; message = ''">{{ registering ? 'Masuk' : 'Daftar' }}</button></p><p class="mt-10 text-center text-[10px] leading-relaxed text-slate-400">Akun baru belum memiliki akses ke jadwal sampai ditambahkan oleh admin.</p></div></section></main></template>
