<script setup lang="ts">
import { Eye, EyeOff } from '@lucide/vue'
import { safePrivateReturn } from '../domain/auth-routing'
import { HOSPITAL_NAME } from '../domain/branding'
definePageMeta({ layout: 'public' })
const db = useNuxtApp().$db, w = useWorkspace(), route = useRoute(), { notify } = useNotifications()
const registering = ref(false), email = ref(''), password = ref(''), visible = ref(false), busy = ref(false), message = ref('')
useSeoMeta({ title: 'Masuk · ' + HOSPITAL_NAME, robots: 'noindex, nofollow' })
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
      message.value = 'Periksa email Anda untuk verifikasi akun.'
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
  <div class="mx-auto grid max-w-5xl gap-7 px-5 py-10 lg:grid-cols-2 lg:items-stretch lg:gap-10 lg:px-8 lg:py-16">
    <section class="app-hero flex flex-col items-center justify-center rounded-[2rem] px-7 py-12 text-center sm:px-10">
      <div class="rounded-[2rem] border border-white bg-white/85 p-6 shadow-sm"><img src="/favicon.svg" alt="" class="h-20 w-20 sm:h-24 sm:w-24" /></div>
      <h1 class="mt-8 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">{{ HOSPITAL_NAME }}</h1>
      <NuxtLink to="/" class="btn btn-secondary mt-8">Beranda</NuxtLink>
    </section>
    <section class="panel p-6 sm:p-8">
      <h2 class="text-2xl font-semibold tracking-tight">{{ registering ? 'Daftar akun' : 'Masuk' }}</h2>
      <p v-if="!db" class="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800" role="status">Login belum tersedia.</p>
      <p v-else-if="w.error.value" class="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700" role="alert">{{ w.error.value }}</p>
      <form class="mt-7 space-y-5" @submit.prevent="submit">
        <div><label for="email" class="label">Email</label><input id="email" v-model="email" type="email" class="field" autocomplete="email" required /></div>
        <div>
          <label for="password" class="label">Kata sandi</label>
          <div class="relative">
            <input id="password" v-model="password" :type="visible ? 'text' : 'password'" class="field pr-12" :autocomplete="registering ? 'new-password' : 'current-password'" :minlength="registering ? 10 : 1" required />
            <button type="button" class="absolute top-1 right-1 rounded-lg p-2.5 text-slate-600" :aria-label="visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'" @click="visible = !visible"><component :is="visible ? EyeOff : Eye" :size="17" /></button>
          </div>
        </div>
        <p v-if="message" class="rounded-xl bg-brand-50 p-4 text-sm text-brand-800" role="status">{{ message }}</p>
        <button class="btn btn-primary w-full" :disabled="busy || !db">{{ busy ? 'Memproses…' : registering ? 'Daftar akun' : 'Masuk' }}</button>
      </form>
      <div class="mt-6 border-t border-slate-100 pt-5 text-center"><button class="text-sm font-semibold text-brand-700" :disabled="busy" @click="registering = !registering; message = ''">{{ registering ? 'Kembali ke login' : 'Daftar akun' }}</button></div>
    </section>
  </div>
</template>
