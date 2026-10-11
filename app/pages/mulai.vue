<script setup lang="ts">
import { Building2, LogOut, RefreshCw } from '@lucide/vue'
definePageMeta({ layout: false })
const w = useWorkspace(), db = useNuxtApp().$db, { notify } = useNotifications()
const name = ref(''), busy = ref(false)
async function create() { busy.value = true; try { await w.createWorkspace(name.value); await navigateTo('/') } catch (e) { notify((e as Error).message, true) } finally { busy.value = false } }
async function refresh() { await w.reload(); if (!w.needsWorkspace.value) await navigateTo('/') }
</script>
<template><main class="flex min-h-dvh items-center justify-center p-5"><div class="panel w-full max-w-lg p-8"><img src="/favicon.svg" alt="Ruang Dinas" class="mb-6 h-11 w-11"/><h1 class="text-2xl font-semibold tracking-tight">Siapkan ruang kerja</h1><p class="mt-3 text-sm leading-relaxed text-slate-500">Buat ruang kerja untuk rumah sakit Anda, atau tunggu admin menambahkan akun ini ke ruang kerja yang sudah ada.</p><form class="mt-7 space-y-4" @submit.prevent="create"><div><label for="workspace-name" class="label">Nama rumah sakit</label><input id="workspace-name" v-model="name" class="field" maxlength="180" required/></div><button class="btn btn-primary w-full" :disabled="busy || !db"><Building2 :size="16"/>{{ busy ? 'Membuat…' : 'Buat ruang kerja baru' }}</button></form><div class="mt-7 border-t border-slate-100 pt-5"><p class="text-xs leading-relaxed text-slate-400">Jika Anda anggota tim, berikan email {{ w.session.value?.user.email }} kepada admin. Setelah ditambahkan, muat ulang akses.</p><button class="btn btn-secondary mt-4 w-full" @click="refresh"><RefreshCw :size="15"/>Muat ulang akses</button><button class="btn btn-quiet mt-2 w-full" @click="db?.auth.signOut()"><LogOut :size="15"/>Keluar</button></div></div></main></template>
