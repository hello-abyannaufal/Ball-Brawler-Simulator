// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  ssr: true,
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxt/eslint',
    'nuxt-auth-utils',
  ],
  css: ['~/assets/css/tailwind.css'],
  typescript: {
    typeCheck: true,
    strict: true,
  },
})
