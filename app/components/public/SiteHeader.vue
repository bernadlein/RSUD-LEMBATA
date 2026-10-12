<script setup lang="ts">
import { Menu, X } from '@lucide/vue'
import type { PublicContactItem, PublicNavItem } from '../../domain/public-portal'

const props = defineProps<{
  name: string; city: string; links: PublicNavItem[]; phone?: PublicContactItem;
  accountUrl: string; accountLabel: string; currentPath: string;
}>()
const open = ref(false), menuButton = ref<HTMLButtonElement | null>(null)
watch(() => props.currentPath, () => { open.value = false })
function closeMenu() {
  if (!open.value) return
  open.value = false
  menuButton.value?.focus()
}
</script>
<template>
  <header class="public-header screen-only" @keydown.esc="closeMenu">
    <div class="public-utility">
      <div class="public-container flex min-h-9 flex-wrap items-center justify-between gap-x-6 gap-y-1 py-1.5">
        <p>
          Rumah Sakit Umum Daerah
          <span class="ml-1 font-semibold">{{ city }}</span>
        </p>
        <a v-if="phone?.href" :href="phone.href" class="font-semibold">{{ phone.text }}</a>
        <span v-else-if="phone" class="font-semibold">{{ phone.text }}</span>
      </div>
    </div>
    <div class="public-container flex min-h-21 items-center justify-between gap-4">
      <NuxtLink to="/" class="public-brand" :aria-label="name + ', beranda'" @click="open = false">
        <img src="/favicon.svg" alt="" width="44" height="44" class="h-10 w-10 shrink-0 sm:h-11 sm:w-11" />
        <span class="min-w-0">
          <span class="block text-[13px] font-bold tracking-[-0.025em] sm:text-base">{{ name }}</span>
          <span class="mt-0.5 block text-[11px] text-slate-600 sm:text-xs">{{ city }}</span>
        </span>
      </NuxtLink>
      <nav class="hidden items-center gap-1 xl:flex" aria-label="Menu utama">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="public-nav-link"
          :class="{ 'is-active': link.active }"
          :aria-current="link.active ? 'page' : undefined"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>
      <div class="flex shrink-0 items-center gap-2">
        <NuxtLink :to="accountUrl" class="public-button public-button-outline px-3.5 sm:px-5">{{ accountLabel }}</NuxtLink>
        <button
          ref="menuButton"
          type="button"
          class="public-menu-button inline-flex xl:hidden"
          :aria-expanded="open"
          aria-controls="public-menu"
          :aria-label="open ? 'Tutup menu' : 'Buka menu'"
          @click="open = !open"
        >
          <component :is="open ? X : Menu" :size="20" />
        </button>
      </div>
    </div>
    <nav v-if="open" id="public-menu" class="public-mobile-menu xl:hidden" aria-label="Menu utama ponsel">
      <div class="public-container grid gap-1 py-3">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="public-nav-link"
          :class="{ 'is-active': link.active }"
          :aria-current="link.active ? 'page' : undefined"
          @click="open = false"
        >
          {{ link.label }}
        </NuxtLink>
      </div>
    </nav>
  </header>
</template>
