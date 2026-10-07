import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

// Two test projects:
// - `engine`: framework-free pure TypeScript (engine/**), Node env, no DOM.
// - `app`: Nuxt/Vue app and component tests under happy-dom.
export default defineConfig(async () => ({
  test: {
    projects: [
      {
        test: {
          name: 'engine',
          environment: 'node',
          include: ['engine/**/*.{test,spec}.ts', 'test/engine/**/*.{test,spec}.ts'],
        },
      },
      await defineVitestProject({
        test: {
          name: 'app',
          environment: 'nuxt',
          environmentOptions: {
            nuxt: {
              domEnvironment: 'happy-dom',
            },
          },
          include: ['tests/**/*.{test,spec}.ts', 'test/app/**/*.{test,spec}.ts', 'app/**/*.{test,spec}.ts'],
          exclude: ['engine/**', 'test/engine/**', 'node_modules/**'],
        },
      }),
    ],
  },
}))
