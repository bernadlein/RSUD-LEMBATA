<script setup lang="ts">
import '../assets/css/public.css'
import PublicSiteHeader from '../components/public/SiteHeader.vue'
import PublicSiteFooter from '../components/public/SiteFooter.vue'

const { identity, contacts, phone, navigation, account, currentPath, year } = usePublicPortal()
</script>
<template>
  <div class="public-site flex min-h-dvh flex-col">
    <a
      href="#public-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-lg focus:bg-white focus:p-3"
    >
      Lewati ke konten
    </a>
    <PublicSiteHeader
      :name="identity.name"
      :city="identity.city"
      :links="navigation"
      :phone="phone"
      :account-url="account.url"
      :account-label="account.label"
      :current-path="currentPath"
    />
    <main id="public-content" class="flex-1" tabindex="-1">
      <slot />
    </main>
    <PublicSiteFooter :name="identity.name" :city="identity.city" :links="navigation" :contacts="contacts" :year="year" />
  </div>
</template>
