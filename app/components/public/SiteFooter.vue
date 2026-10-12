<script setup lang="ts">
import type { PublicContactItem, PublicNavItem } from '../../domain/public-portal'
defineProps<{ name: string; city: string; links: PublicNavItem[]; contacts: PublicContactItem[]; year: number }>()
</script>
<template>
  <footer class="public-footer">
    <div class="public-container grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.1fr_0.7fr_1.2fr] lg:gap-16 lg:py-16">
      <div>
        <NuxtLink to="/" class="public-brand">
          <img src="/favicon.svg" alt="" width="44" height="44" class="h-11 w-11" />
          <span>
            <span class="block font-bold tracking-tight">{{ name }}</span>
            <span class="mt-1 block text-sm text-slate-600">{{ city }}</span>
          </span>
        </NuxtLink>
        <p class="mt-5 max-w-xs text-sm leading-7 text-slate-600">Jadwal dokter dan informasi rumah sakit.</p>
      </div>
      <div>
        <h2 class="text-sm font-semibold">Informasi</h2>
        <nav class="mt-5 grid justify-items-start gap-3 text-sm text-slate-600" aria-label="Menu footer">
          <NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="hover:text-brand-700">{{ link.label }}</NuxtLink>
        </nav>
      </div>
      <div v-if="contacts.length" class="sm:col-span-2 lg:col-span-1">
        <h2 class="text-sm font-semibold">Hubungi rumah sakit</h2>
        <dl class="mt-5 space-y-4">
          <div v-for="contact in contacts" :key="contact.id">
            <dt class="text-xs font-medium text-brand-700">{{ contact.label }}</dt>
            <dd class="mt-1 text-sm leading-6 text-slate-600">
              <a
                v-if="contact.href"
                :href="contact.href"
                :target="contact.external ? '_blank' : undefined"
                :rel="contact.external ? 'noopener noreferrer' : undefined"
                class="break-words hover:text-brand-700"
              >
                {{ contact.text }}
              </a>
              <span v-else class="break-words">{{ contact.text }}</span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
    <div class="border-t border-brand-100">
      <div class="public-container flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-slate-600">
        <p>© {{ year }} {{ name }}</p>
        <NuxtLink to="/masuk" class="font-medium hover:text-brand-700">Akses staf</NuxtLink>
      </div>
    </div>
  </footer>
</template>
