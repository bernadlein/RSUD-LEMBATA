<script setup lang="ts">
import type { PublicContactItem } from '../../domain/public-portal'
defineProps<{ name: string; contacts: PublicContactItem[] }>()
</script>
<template>
  <section v-if="contacts.length" id="kontak" class="public-contact-panel public-section">
    <div>
      <p class="public-eyebrow">Kontak rumah sakit</p>
      <h2 class="public-section-title mt-4">Hubungi {{ name }}</h2>
    </div>
    <dl class="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="contact in contacts" :key="contact.id" class="min-w-0">
        <dt class="text-xs font-semibold text-brand-700">{{ contact.label }}</dt>
        <dd class="mt-3 text-sm leading-7 text-slate-700">
          <a
            v-if="contact.href"
            :href="contact.href"
            :target="contact.external ? '_blank' : undefined"
            :rel="contact.external ? 'noopener noreferrer' : undefined"
            class="break-words underline decoration-brand-200 underline-offset-4 hover:decoration-brand-600"
          >
            {{ contact.text }}
          </a>
          <span v-else class="break-words">{{ contact.text }}</span>
        </dd>
      </div>
    </dl>
  </section>
</template>
