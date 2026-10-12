<script setup lang="ts">
import { Building2, LogOut, RefreshCw } from '@lucide/vue'
import { safePrivateReturn } from '../domain/auth-routing'
definePageMeta({ layout: 'public' })
const w = useWorkspace(), db = useNuxtApp().$db, { notify } = useNotifications(), route = useRoute()
const target = computed(() => safePrivateReturn(route.query.returnTo))
const hospitalId = useRuntimeConfig().public.hospitalId
const canCreate = computed(() => !hospitalId && !target.value.startsWith('/absen'))
const name = ref(''), busy = ref(false)
async function create() {
  if (!canCreate.value) return
  busy.value = true
  try { await w.createWorkspace(name.value); await navigateTo('/dashboard') }
  catch (error) { notify((error as Error).message, true) }
  finally { busy.value = false }
}
async function refresh() { await w.reload(); if (!w.needsWorkspace.value) await navigateTo(target.value) }
async function logout() { await db?.auth.signOut(); await navigateTo('/') }
</script>
<template>
  <div class="mx-auto max-w-xl px-5 py-14"><section class="panel p-7 sm:p-9"><img src="/favicon.svg" alt="" class="mb-6 h-11 w-11" /><h1 class="text-2xl font-semibold tracking-tight">{{ canCreate ? 'Siapkan ruang kerja' : 'Menunggu akses fasilitas' }}</h1><p class="mt-4 text-sm leading-relaxed text-slate-600">{{ canCreate ? 'Admin awal dapat membuat ruang kerja rumah sakit. Anggota tim menunggu admin menambahkan akun mereka.' : 'Minta admin rumah sakit menambahkan email Anda ke fasilitas. Untuk absensi, akun juga perlu dihubungkan dengan nama dokter.' }}</p><form v-if="canCreate" class="mt-7 space-y-4" @submit.prevent="create"><div><label for="workspace-name" class="label">Nama rumah sakit</label><input id="workspace-name" v-model="name" class="field" maxlength="180" required /></div><button class="btn btn-primary w-full" :disabled="busy || !db"><Building2 :size="16" />{{ busy ? 'Membuat…' : 'Buat ruang kerja' }}</button></form><div class="mt-7 border-t border-slate-100 pt-5"><p class="text-xs leading-relaxed text-slate-600">Email akun: {{ w.session.value?.user.email }}</p><button class="btn btn-secondary mt-4 w-full" @click="refresh"><RefreshCw :size="15" />Muat ulang akses</button><NuxtLink to="/" class="btn btn-quiet mt-2 w-full">Baca informasi publik</NuxtLink><button class="btn btn-quiet mt-2 w-full" @click="logout"><LogOut :size="15" />Keluar</button></div></section></div>
</template>
