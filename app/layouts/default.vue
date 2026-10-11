<script setup lang="ts">
import { LayoutDashboard, CalendarDays, ChartNoAxesColumnIncreasing, Clock3, UsersRound, Settings2, Printer, PanelLeftClose, X, Menu, LogOut, RefreshCw, ShieldCheck, Activity } from '@lucide/vue'
const w = useWorkspace(), route = useRoute(), open = ref(false)
const nav = [
  { to: '/', label: 'Ringkasan', icon: LayoutDashboard }, { to: '/jadwal', label: 'Jadwal bulanan', icon: CalendarDays },
  { to: '/rekap', label: 'Rekap jam kerja', icon: ChartNoAxesColumnIncreasing }, { to: '/kode-dinas', label: 'Kode & jam dinas', icon: Clock3 },
  { to: '/dokter', label: 'Daftar dokter', icon: UsersRound }, { to: '/cetak', label: 'Cetak jadwal', icon: Printer },
]
watch(() => route.path, () => { open.value = false })
async function logout() { await useNuxtApp().$db?.auth.signOut() }
const roleLabel = computed(() => ({ admin: 'Administrator', planner: 'Penyusun jadwal', viewer: 'Pembaca' }[w.role.value]))
</script>
<template>
  <div class="min-h-screen">
    <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-lg focus:bg-white focus:p-3">Lewati ke konten</a>
    <div v-if="open" class="app-sidebar fixed inset-0 z-40 bg-slate-950/30 lg:hidden" @click="open = false" />
    <aside class="app-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200/80 bg-white transition-transform lg:translate-x-0" :class="open ? 'translate-x-0' : '-translate-x-full'">
      <NuxtLink to="/" class="flex items-center gap-3 px-6 pt-8 pb-7"><img src="/favicon.svg" class="h-10 w-10" alt=""/><div><p class="text-lg font-bold tracking-tight text-slate-900">Ruang Dinas<span class="text-brand-600">.</span></p><p class="mt-0.5 text-[10px] font-medium tracking-[0.13em] text-slate-400 uppercase">Manajemen jadwal dokter</p></div></NuxtLink>
      <button v-if="open" aria-label="Tutup menu" class="absolute top-3 right-3 lg:hidden" @click="open = false"><X :size="18"/></button>
      <div class="mx-5 mb-7 rounded-xl bg-brand-50 px-4 py-3"><p class="eyebrow text-brand-700/65">Ruang kerja</p><p class="mt-1.5 truncate text-sm font-semibold text-brand-800">{{ w.data.value?.settings.hospital || 'Ruang Dinas' }}</p></div>
      <p class="eyebrow px-7 pb-3">Menu utama</p>
      <nav aria-label="Menu utama" class="space-y-1 px-4"><NuxtLink v-for="item in nav" :key="item.to" :to="item.to" class="flex items-center gap-3 rounded-xl px-3.5 py-3 text-[13px] font-medium transition-colors" :class="route.path === item.to ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'" :aria-current="route.path === item.to ? 'page' : undefined"><component :is="item.icon" :size="18" :stroke-width="1.8"/>{{ item.label }}<span v-if="route.path === item.to" class="ml-auto h-1.5 w-1.5 rounded-full bg-lime-soft" /></NuxtLink></nav>
      <div class="mt-auto px-5 pt-8 pb-6"><div class="mb-5 rounded-xl border border-slate-100 p-4"><div class="mb-2 flex items-center gap-2 text-brand-700"><ShieldCheck :size="17"/><span class="text-xs font-semibold">{{ w.mode === 'demo' ? 'Mode demo lokal' : 'Ruang kerja bersama' }}</span></div><p class="text-xs leading-relaxed text-slate-400">{{ w.mode === 'demo' ? 'Data tersimpan di browser ini. Unduh cadangan untuk memindahkannya.' : 'Akses dan penyimpanan mengikuti hak akun Anda.' }}</p></div><NuxtLink to="/pengaturan" class="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-500 hover:text-brand-700"><Settings2 :size="18"/>Pengaturan</NuxtLink></div>
    </aside>
    <div class="app-main lg:ml-64">
      <header class="app-topbar flex h-[76px] items-center justify-between gap-3 border-b border-slate-200/70 bg-white/85 px-5 lg:px-9">
        <div class="flex min-w-0 items-center gap-3"><button class="lg:hidden" aria-label="Buka menu" @click="open = true"><Menu :size="22"/></button><span class="hidden h-2 w-2 rounded-full bg-brand-500 sm:block"/><p class="truncate text-xs text-slate-500">{{ w.mode === 'demo' ? 'Demo aplikasi · data contoh' : w.session.value?.user.email }}</p></div>
        <div class="flex items-center gap-3"><button class="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-brand-700 disabled:opacity-40" :disabled="w.loading.value || w.saving.value" aria-label="Muat ulang data" @click="w.reload()"><RefreshCw :size="17" :class="w.loading.value ? 'animate-spin' : ''"/></button><span class="hidden text-xs text-slate-400 sm:inline">{{ w.saving.value ? 'Menyimpan…' : `Tersimpan · v${w.revision.value}` }}</span><span class="h-7 w-px bg-slate-200"/><div class="flex items-center gap-2.5"><div class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">{{ w.role.value === 'admin' ? 'AD' : w.role.value === 'planner' ? 'PJ' : 'PB' }}</div><div class="hidden sm:block"><p class="text-xs font-semibold">{{ roleLabel }}</p><p class="mt-0.5 text-[10px] text-slate-400">{{ w.mode === 'demo' ? 'Akun demo' : 'Akun terverifikasi' }}</p></div></div><button v-if="w.mode === 'supabase'" aria-label="Keluar" class="p-2 text-slate-400" @click="logout"><LogOut :size="17"/></button></div>
      </header>
      <main id="main-content" class="app-content mx-auto max-w-[1700px] px-5 py-7 lg:px-9 lg:py-9">
        <div v-if="w.loading.value" class="panel flex items-center gap-3 p-8 text-sm text-slate-500"><RefreshCw :size="20" class="animate-spin text-brand-600"/>Memuat ruang kerja…</div>
        <div v-else-if="w.error.value" class="panel border-rose-200 p-8"><h1 class="font-semibold">Ruang kerja belum dapat dimuat</h1><p class="mt-3 text-sm text-rose-700">{{ w.error.value }}</p><button class="btn btn-secondary mt-5" @click="w.reload()">Coba lagi</button></div>
        <slot v-else />
      </main>
    </div>
  </div>
</template>
