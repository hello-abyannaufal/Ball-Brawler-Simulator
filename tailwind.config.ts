import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      // Subset of the Endesga 32 palette (docs/ASSETS_PLAN.md) used by the UI.
      colors: {
        edg: {
          ink: '#181425',
          night: '#262b44',
          slate: '#3a4466',
          steel: '#5a6988',
          mist: '#8b9bb4',
          fog: '#c0cbdc',
          sand: '#ead4aa',
          gold: '#feae34',
          orange: '#f77622',
          sun: '#fee761',
          red: '#e43b44',
          wine: '#a22633',
          rust: '#733e39',
          brown: '#3e2731',
          green: '#63c74d',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        retro: ['VT323', 'monospace'],
      },
    },
  },
}
