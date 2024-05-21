// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ["nuxt-quasar-ui", "@nuxtjs/tailwindcss"],
  quasar: {
    plugins: ["Notify"],
    sassVariables: "./styles/quasar-variables.sass",
  },
});
