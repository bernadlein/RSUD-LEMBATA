<script setup lang="ts">
import { LayoutDashboard, CalendarDays, ChartNoAxesColumnIncreasing, Clock3, UsersRound, Settings2, Printer, X, Menu, LogOut, RefreshCw, ShieldCheck, QrCode } from '@lucide/vue'
const w = useWorkspace(), route = useRoute(), open = ref(false), desktop = ref(true)
const nav = [
  { to: '/', label: 'Ringkasan', icon: LayoutDashboard }, { to: '/jadwal', label: 'Jadwal bulanan', icon: CalendarDays },
  { to: '/dokter', label: 'Tim dokter', icon: UsersRound }, { to: '/absen', label: 'Absensi', icon: QrCode },
  { to: '/rekap', label: 'Rekap jam kerja', icon: ChartNoAxesColumnIncreasing }, { to: '/kode-dinas', label: 'Kode & jam dinas', icon: Clock3 },
  { to: '/cetak', label: 'Cetak jadwal', icon: Printer },
]
const mobileNav = computed(() => nav.filter(n => ['/', '/jadwal', '/dokter', '/absen'].includes(n.to)))
const roleLabel = computed(() => ({ admin: 'Administrator', planner: 'Penyusun jadwal', viewer: 'Pembaca' }[w.role.value]))
let media: MediaQueryList | null = null
function resize() { desktop.value = !!media?.matches; if (desktop.value) open.value = false }
function keydown(event: KeyboardEvent) { if (event.key === 'Escape') open.value = false }
onMounted(() => { media = window.matchMedia('(min-width: 1024px)'); resize(); media.addEventListener('change', resize); document.addEventListener('keydown', keydown) })
onBeforeUnmount(() => { media?.removeEventListener('change', resize); document.removeEventListener('keydown', keydown) })
watch(() => route.path, () => { open.value = false })
async function logout() { await useNuxtApp().$db?.auth.signOut() }
</script>

<template>
  <div class="min-h-screen">
    <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-lg focus:bg-white focus:p-3">Lewati ke konten</a>
    <div v-if="open" class="app-sidebar fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm lg:hidden" @click="open = false" />
    <aside id="app-navigation" :inert="!desktop && !open" class="app-sidebar fixed inset-y-0 left-0 z-50 flex w-68 flex-col overflow-y-auto bg-ink text-white transition-transform lg:translate-x-0" :class="open ? 'translate-x-0' : '-translate-x-full'">
      <NuxtLink to="/" class="flex items-center gap-3 px-6 pt-8 pb-7"><img src="/favicon.svg" class="h-10 w-10" alt="" /><div><p class="text-lg font-semibold tracking-tight">Ruang Dinas<span class="text-lime-soft">.</span></p><p class="mt-1 text-[10px] tracking-wider text-white/45">JADWAL & KEHADIRAN DOKTER</p></div></NuxtLink>
      <button v-if="open" aria-label="Tutup menu" class="absolute top-3 right-3 rounded-lg p-2 text-white/60 lg:hidden" @click="open = false"><X :size="18" /></button>
      <div class="mx-5 mb-7 rounded-2xl border border-white/8 bg-white/5 p-4"><p class="text-[10px] tracking-widest text-brand-300">FASILITAS PELAYANAN</p><p class="mt-2 text-sm leading-relaxed font-medium">{{ w.data.value?.settings.hospital || 'Ruang Dinas' }}</p></div>
      <p class="px-7 pb-3 text-[10px] font-medium tracking-widest text-white/35">RUANG KERJA</p>
      <nav aria-label="Menu utama" class="space-y-1 px-4"><NuxtLink v-for="item in nav" :key="item.to" :to="item.to" class="flex min-h-12 items-center gap-3 rounded-xl px-3.5 py-3 text-[13px] font-medium transition-colors" :class="route.path === item.to ? 'bg-lime-soft text-ink' : 'text-white/60 hover:bg-white/7 hover:text-white'" :aria-current="route.path === item.to ? 'page' : undefined"><component :is="item.icon" :size="18" :stroke-width="1.7" />{{ item.label }}</NuxtLink></nav>
      <div class="mt-auto px-5 pt-8 pb-6"><NuxtLink to="/pengaturan" class="mb-5 flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] text-white/60 hover:bg-white/7 hover:text-white" :class="route.path === '/pengaturan' ? 'bg-white/7 text-white' : ''"><Settings2 :size="18" />Pengaturan</NuxtLink><div class="rounded-2xl border border-white/8 p-4"><div class="flex items-center gap-2 text-brand-300"><ShieldCheck :size="16" /><span class="text-xs font-medium">{{ w.mode === 'demo' ? 'Pratinjau lokal' : 'Ruang kerja bersama' }}</span></div><p class="mt-2 text-[11px] leading-relaxed text-white/45">{{ w.mode === 'demo' ? 'Data contoh tersimpan pada browser ini.' : 'Akses dikelola sesuai peran akun.' }}</p></div></div>
    </aside>
    <div class="app-main lg:ml-68">
      <header class="app-topbar sticky top-0 z-30 flex h-18 items-center justify-between gap-3 border-b border-slate-200/70 bg-white/90 px-5 backdrop-blur-lg lg:px-9">
        <div class="flex min-w-0 items-center gap-3"><button class="rounded-xl p-2 lg:hidden" aria-label="Buka menu" aria-controls="app-navigation" :aria-expanded="open" @click="open = !open"><Menu :size="21" /></button><div class="min-w-0"><p class="truncate text-xs font-semibold">{{ nav.find(n => n.to === route.path)?.label || 'Pengaturan ruang kerja' }}</p><p class="mt-1 truncate text-[10px] text-slate-500">{{ w.mode === 'demo' ? 'Ruang Dinas · pratinjau aplikasi' : w.session.value?.user.email }}</p></div></div>
        <div class="flex items-center gap-2 sm:gap-4"><span class="hidden items-center gap-2 text-[11px] text-slate-500 sm:flex" aria-live="polite"><span class="h-1.5 w-1.5 rounded-full bg-brand-500" />{{ w.saving.value ? 'Menyimpan…' : 'Tersimpan' }}</span><button class="rounded-xl p-2.5 text-slate-500 hover:bg-brand-50 disabled:opacity-40" :disabled="w.loading.value || w.saving.value" aria-label="Muat ulang data" @click="w.reload()"><RefreshCw :size="16" :class="w.loading.value ? 'animate-spin' : ''" /></button><div class="flex items-center gap-2.5 border-l border-slate-200 pl-3"><div class="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-[11px] font-semibold text-lime-soft">{{ w.role.value === 'admin' ? 'AD' : w.role.value === 'planner' ? 'PJ' : 'PB' }}</div><p class="hidden text-xs font-medium md:block">{{ roleLabel }}</p></div><button v-if="w.mode === 'supabase'" aria-label="Keluar" class="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100" @click="logout"><LogOut :size="16" /></button></div>
      </header>
      <main id="main-content" class="app-content mx-auto max-w-[1700px] px-5 pt-7 pb-28 lg:px-9 lg:py-9">
        <div v-if="w.loading.value" class="panel flex items-center gap-3 p-8 text-sm text-slate-500"><RefreshCw :size="20" class="animate-spin text-brand-600" />Memuat ruang kerja…</div>
        <div v-else-if="w.error.value" class="panel border-rose-200 p-8"><h1 class="font-semibold">Ruang kerja belum dapat dimuat</h1><p class="mt-3 text-sm text-rose-700">{{ w.error.value }}</p><button class="btn btn-secondary mt-5" @click="w.reload()">Coba lagi</button></div>
        <slot v-else />
      </main>
    </div>
    <nav aria-label="Menu cepat ponsel" class="mobile-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-lg lg:hidden"><NuxtLink v-for="item in mobileNav" :key="item.to" :to="item.to" class="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium" :class="route.path === item.to ? 'bg-brand-50 text-brand-700' : 'text-slate-500'" :aria-current="route.path === item.to ? 'page' : undefined"><component :is="item.icon" :size="19" :stroke-width="1.7" />{{ item.to === '/jadwal' ? 'Jadwal' : item.to === '/dokter' ? 'Dokter' : item.label }}</NuxtLink></nav>
  </div>
</template>
