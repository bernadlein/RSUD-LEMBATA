<script setup lang="ts">
import { Menu, X, LogIn, LayoutDashboard } from '@lucide/vue'
const site = usePublicHospital(), w = useWorkspace(), route = useRoute(), open = ref(false)
const name = computed(() => site.hospital.value?.name ?? 'Informasi Rumah Sakit')
const links = [{ to: '/', label: 'Beranda' }, { to: '/jadwal-dokter', label: 'Jadwal dokter' }, { to: '/berita', label: 'Berita RS' }]
const active = (to: string) => to === '/' ? route.path === '/' : route.path.startsWith(to)
watch(() => route.fullPath, () => { open.value = false })
</script>
<template>
  <div class="flex min-h-dvh flex-col bg-white">
    <a href="#public-content" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-lg focus:bg-white focus:p-3">Lewati ke konten</a>
    <header class="sticky top-0 z-40 border-b border-brand-100 bg-white/95 backdrop-blur-lg">
      <div class="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
        <NuxtLink to="/" class="flex min-w-0 items-center gap-3"><img src="/favicon.svg" alt="" class="h-11 w-11 shrink-0" /><div class="min-w-0"><p class="truncate text-base font-semibold sm:text-lg">{{ name }}</p><p class="mt-1 text-[10px] font-medium tracking-widest text-brand-700">PORTAL INFORMASI DAN PELAYANAN</p></div></NuxtLink>
        <nav class="hidden items-center gap-1 md:flex" aria-label="Informasi publik"><NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="rounded-xl px-4 py-3 text-sm font-medium" :class="active(link.to) ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-brand-50'" :aria-current="active(link.to) ? 'page' : undefined">{{ link.label }}</NuxtLink></nav>
        <div class="flex items-center gap-2"><NuxtLink :to="w.session.value ? '/dashboard' : '/masuk'" class="btn" :class="w.session.value ? 'btn-lime' : 'btn-primary'"><component :is="w.session.value ? LayoutDashboard : LogIn" :size="15" /><span class="hidden sm:inline">{{ w.session.value ? 'Ruang kerja' : 'Masuk' }}</span></NuxtLink><button class="btn btn-secondary p-3 md:hidden" :aria-expanded="open" aria-controls="public-menu" aria-label="Buka menu informasi" @click="open = !open"><component :is="open ? X : Menu" :size="18" /></button></div>
      </div>
      <nav v-if="open" id="public-menu" class="grid gap-1 border-t border-brand-100 px-5 py-3 md:hidden" aria-label="Informasi publik ponsel"><NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="rounded-xl px-4 py-3 text-sm font-medium" :class="active(link.to) ? 'bg-brand-50 text-brand-800' : 'text-slate-600'">{{ link.label }}</NuxtLink></nav>
    </header>
    <main id="public-content" class="flex-1"><slot /></main>
    <footer class="mt-12 border-t border-brand-100 bg-brand-50/60">
      <div class="mx-auto grid max-w-7xl gap-7 px-5 py-10 sm:grid-cols-2 lg:px-8"><div><p class="font-semibold">{{ name }}</p><p v-if="site.hospital.value?.address" class="mt-3 max-w-md text-sm leading-relaxed text-slate-600">{{ site.hospital.value.address }}</p><p class="mt-3 text-xs leading-relaxed text-slate-500">Informasi yang ditampilkan mengikuti publikasi rumah sakit.</p></div><div class="flex flex-wrap items-start gap-6 text-sm text-brand-800"><NuxtLink to="/jadwal-dokter">Jadwal dokter</NuxtLink><NuxtLink to="/berita">Berita RS</NuxtLink><NuxtLink to="/masuk">Akses tim rumah sakit</NuxtLink></div></div>
    </footer>
  </div>
</template>
