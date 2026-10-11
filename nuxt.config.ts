import tailwindcss from '@tailwindcss/vite'

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
      storageMode: 'demo',
      supabaseUrl: '',
      supabaseAnonKey: '',
    },
  },
  app: {
    head: {
      title: 'Ruang Dinas · Jadwal Dokter',
      htmlAttrs: { lang: 'id' },
      meta: [
        { name: 'description', content: 'Susun jadwal dokter, hitung jam dinas, dan cetak jadwal bulanan.' },
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'theme-color', content: '#008e91' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
  routeRules: {
    '/**': { headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } },
  },
})
