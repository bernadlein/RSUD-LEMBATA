<script setup lang="ts">
import { LayoutDashboard, CalendarDays, ChartNoAxesColumnIncreasing, Clock3, UsersRound, Settings2, Printer, X, Menu, LogOut, RefreshCw, ShieldCheck, QrCode, Globe } from '@lucide/vue'
import { HOSPITAL_NAME } from '../domain/branding'
const w = useWorkspace(), route = useRoute(), open = ref(false), desktop = ref(false)
const nav = computed(() => [
  { to: '/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { to: '/jadwal', label: 'Jadwal bulanan', icon: CalendarDays },
  { to: '/dokter', label: 'Tim dokter', icon: UsersRound },
  { to: '/absen', label: 'Absensi', icon: QrCode },
  { to: '/rekap', label: 'Rekap jam kerja', icon: ChartNoAxesColumnIncreasing },
  { to: '/kode-dinas', label: 'Kode & jam dinas', icon: Clock3 },
  { to: '/cetak', label: 'Cetak jadwal', icon: Printer },
  ...(w.isAdmin.value ? [{ to: '/portal', label: 'Portal & lokasi RS', icon: Globe }] : []),
])
const mobileNav = computed(() => nav.value.filter(n => ['/dashboard', '/jadwal', '/dokter', '/absen'].includes(n.to)))
const roleLabel = computed(() => w.isAdmin.value ? 'Administrator' : 'Pembaca')
let media: MediaQueryList | null = null
function resize() { desktop.value = !!media?.matches; if (desktop.value) open.value = false }
function keydown(event: KeyboardEvent) { if (event.key === 'Escape') open.value = false }
onMounted(() => { media = window.matchMedia('(min-width: 1024px)'); resize(); media.addEventListener('change', resize); document.addEventListener('keydown', keydown) })
onBeforeUnmount(() => { media?.removeEventListener('change', resize); document.removeEventListener('keydown', keydown) })
watch(() => route.path, () => { open.value = false })
async function logout() { await useNuxtApp().$db?.auth.signOut(); await navigateTo('/') }
</script>

<template>
  <div class="min-h-screen">
    <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-lg focus:bg-white focus:p-3">Lewati ke konten</a>
    <div v-if="open" class="app-sidebar fixed inset-0 z-40 bg-brand-200/50 backdrop-blur-sm lg:hidden" @click="open = false" />
    <aside id="app-navigation" :inert="!desktop && !open" class="app-sidebar fixed inset-y-0 left-0 z-50 flex w-68 flex-col overflow-y-auto border-r border-brand-100 bg-white text-ink transition-transform lg:translate-x-0" :class="open ? 'translate-x-0' : '-translate-x-full'">
      <NuxtLink to="/dashboard" class="flex items-center gap-3 px-5 pt-8 pb-7"><img src="/favicon.svg" class="h-10 w-10" alt="" /><p class="text-sm font-semibold tracking-tight">{{ HOSPITAL_NAME }}</p></NuxtLink>
      <button v-if="open" aria-label="Tutup menu" class="absolute top-3 right-3 rounded-lg p-2 text-slate-600 lg:hidden" @click="open = false"><X :size="18" /></button>
      <p class="px-7 pb-3 text-xs font-medium tracking-widest text-slate-600">RUANG KERJA</p>
      <nav aria-label="Menu utama" class="space-y-1 px-4">
        <NuxtLink v-for="item in nav" :key="item.to" :to="item.to" class="flex min-h-12 items-center gap-3 rounded-xl px-3.5 py-3 text-[13px] font-medium transition-colors" :class="route.path === item.to ? 'bg-brand-100 text-brand-800' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'" :aria-current="route.path === item.to ? 'page' : undefined"><component :is="item.icon" :size="18" :stroke-width="1.7" />{{ item.label }}</NuxtLink>
      </nav>
      <div class="mt-auto px-5 pt-8 pb-6">
        <NuxtLink v-if="w.isAdmin.value" to="/pengaturan" class="mb-3 flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] text-slate-600 hover:bg-brand-50" :class="route.path === '/pengaturan' ? 'bg-brand-50 text-brand-800' : ''"><Settings2 :size="18" />Pengaturan</NuxtLink>
        <NuxtLink to="/" class="btn btn-secondary mb-5 w-full"><Globe :size="15" />Lihat portal publik</NuxtLink>
        <div class="rounded-2xl border border-brand-100 bg-[#f7fbe8] p-4"><div class="flex items-center gap-2 text-brand-700"><ShieldCheck :size="16" /><span class="text-sm font-medium">{{ roleLabel }}</span></div></div>
      </div>
    </aside>
    <div class="app-main lg:ml-68">
      <header class="app-topbar sticky top-0 z-30 flex h-18 items-center justify-between gap-3 border-b border-brand-100 bg-white/95 px-5 backdrop-blur-lg lg:px-9">
        <div class="flex min-w-0 items-center gap-3"><button class="rounded-xl p-2 lg:hidden" aria-label="Buka menu" aria-controls="app-navigation" :aria-expanded="open" @click="open = !open"><Menu :size="21" /></button><div class="min-w-0"><p class="truncate text-xs font-semibold">{{ nav.find(n => n.to === route.path)?.label || 'Pengaturan ruang kerja' }}</p><p class="mt-1 truncate text-xs text-slate-600">{{ w.session.value?.user.email }}</p></div></div>
        <div class="flex items-center gap-2 sm:gap-4">
          <span class="hidden items-center gap-2 text-xs text-slate-600 sm:flex" aria-live="polite"><span class="h-1.5 w-1.5 rounded-full bg-brand-500" />{{ w.saving.value ? 'Menyimpan…' : 'Tersimpan' }}</span>
          <button class="rounded-xl p-2.5 text-slate-600 hover:bg-brand-50 disabled:opacity-40" :disabled="w.loading.value || w.saving.value" aria-label="Muat ulang data" @click="w.reload()"><RefreshCw :size="16" :class="w.loading.value ? 'animate-spin' : ''" /></button>
          <div class="flex items-center gap-2.5 border-l border-slate-200 pl-3"><div class="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-xs font-semibold text-brand-800">{{ w.isAdmin.value ? 'AD' : 'PB' }}</div><p class="hidden text-xs font-medium md:block">{{ roleLabel }}</p></div>
          <button aria-label="Keluar" class="rounded-xl p-2.5 text-slate-600 hover:bg-brand-50" @click="logout"><LogOut :size="16" /></button>
        </div>
      </header>
      <main id="main-content" class="app-content mx-auto max-w-[1700px] px-5 pt-7 pb-28 lg:px-9 lg:py-9">
        <div v-if="w.loading.value" class="panel flex items-center gap-3 p-8 text-sm text-slate-600"><RefreshCw :size="20" class="animate-spin text-brand-600" />Memuat ruang kerja…</div>
        <div v-else-if="w.error.value" class="panel border-rose-200 p-8"><h1 class="font-semibold">Ruang kerja belum dapat dimuat</h1><p class="mt-3 text-sm text-rose-700">{{ w.error.value }}</p><button class="btn btn-secondary mt-5" @click="w.reload()">Coba lagi</button></div>
        <slot v-else-if="w.session.value" />
      </main>
    </div>
    <nav aria-label="Menu cepat ponsel" class="mobile-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-brand-100 bg-white/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-lg lg:hidden"><NuxtLink v-for="item in mobileNav" :key="item.to" :to="item.to" class="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium" :class="route.path === item.to ? 'bg-brand-50 text-brand-700' : 'text-slate-600'" :aria-current="route.path === item.to ? 'page' : undefined"><component :is="item.icon" :size="19" :stroke-width="1.7" />{{ item.to === '/jadwal' ? 'Jadwal' : item.to === '/dokter' ? 'Dokter' : item.label }}</NuxtLink></nav>
  </div>
</template>
