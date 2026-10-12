import tailwindcss from '@tailwindcss/vite'
import { HOSPITAL_NAME } from './app/domain/branding'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: false },
  css: ['@fontsource-variable/inter', '~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  typescript: { strict: true },
  nitro: {
    vercel: { functions: { runtime: 'nodejs24.x' } },
  },
  runtimeConfig: {
    supabaseServiceRoleKey: '',
    public: {
      storageMode: 'supabase',
      supabaseUrl: '',
      supabaseAnonKey: '',
      hospitalId: '',
    },
  },
  app: {
    head: {
      title: HOSPITAL_NAME,
      htmlAttrs: { lang: 'id' },
      meta: [
        { name: 'description', content: 'Jadwal dokter dan berita RSUD LEWOLEBA.' },
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'theme-color', content: '#00a8b5' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
  routeRules: {
    '/**': { headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'geolocation=(self)' } },
  },
})
