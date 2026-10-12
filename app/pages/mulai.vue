<script setup lang="ts">
import { LogOut, RefreshCw } from '@lucide/vue'
import { safePrivateReturn } from '../domain/auth-routing'
import { HOSPITAL_NAME } from '../domain/branding'
definePageMeta({ layout: 'public' })
const w = useWorkspace(), db = useNuxtApp().$db, route = useRoute()
const target = computed(() => safePrivateReturn(route.query.returnTo))
useSeoMeta({ title: 'Akses · ' + HOSPITAL_NAME, robots: 'noindex, nofollow' })
async function refresh() { await w.reload(); if (!w.needsWorkspace.value && w.data.value) await navigateTo(target.value) }
async function logout() { await db?.auth.signOut(); await navigateTo('/') }
</script>
<template>
  <div class="mx-auto max-w-xl px-5 py-14">
    <section class="panel p-7 sm:p-9">
      <img src="/favicon.svg" alt="" class="mb-6 h-11 w-11" />
      <h1 class="text-2xl font-semibold tracking-tight">Akses akun</h1>
      <p v-if="w.error.value" class="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700" role="alert">{{ w.error.value }}</p>
      <p v-else class="mt-5 text-sm text-slate-600" role="status">{{ w.loading.value ? 'Memuat akses…' : 'Akses akun belum tersedia.' }}</p>
      <p class="mt-6 break-all text-sm text-slate-600">{{ w.session.value?.user.email }}</p>
      <button class="btn btn-secondary mt-5 w-full" :disabled="w.loading.value" @click="refresh"><RefreshCw :size="15" />Muat ulang akses</button>
      <NuxtLink to="/" class="btn btn-quiet mt-2 w-full">Beranda</NuxtLink>
      <button class="btn btn-quiet mt-2 w-full" @click="logout"><LogOut :size="15" />Keluar</button>
    </section>
  </div>
</template>
