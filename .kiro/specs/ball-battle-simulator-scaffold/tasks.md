# Implementation Plan: Ball Battle Simulator — Phase 1 (Scaffold)

## Overview

Build the Nuxt 3 + TypeScript scaffold incrementally: initialize the project and config (TypeScript strict, ESLint, Tailwind), wire Pinia + persistence with a removable example store and a persistence-failure notification surface, create the architecture-compliant folder structure, add the portrait layout and shared navigation menu, and add the eight placeholder pages plus the catch-all not-found view. Each task ends with type-check / lint / build / test verification per the design Testing Strategy. No feature behavior is implemented — this phase is scaffolding only.

Node engine: before any `npm install`, dev, build, type-check, or lint, select a supported Node version with `nvm use <version>` (range `>=18.12.0`, e.g. v18.20.8 / v22.22.2 / v24.13.1).

## Tasks

- [x] 1. Initialize Nuxt 3 project and base configuration
  - [x] 1.1 Create Nuxt 3 project skeleton and package manifest
    - Initialize a Nuxt 3 app (Vue 3 Composition API, `<script setup>`, TypeScript) at the repo root
    - Create `package.json` with `dev`, `build`, `preview`, `typecheck`, `lint`, `test` scripts
    - Declare `engines.node` as `>=18.12.0`
    - Create `nuxt.config.ts` with SSR default; placeholders for modules and global CSS added in later tasks
    - Create `app.vue` rendering `<NuxtLayout><NuxtPage/></NuxtLayout>`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [x] 1.2 Configure strict TypeScript
    - Create `tsconfig.json` extending `./.nuxt/tsconfig.json` with explicit `strict: true` (optionally `noUncheckedIndexedAccess`, `noImplicitOverride`)
    - Enable `typescript.typeCheck` and `typescript.strict` in `nuxt.config.ts`
    - _Requirements: 2.1, 2.2_

  - [x]* 1.3 Verify fresh scaffold type-checks and builds clean
    - Run `nvm use <supported version>`, then `npm install`
    - Run `npm run typecheck` → expect zero errors, zero exit (Req 2.3, 2.4, 2.5)
    - Run `npm run build` → expect build output, zero errors, zero exit (Req 1.6, 1.7)
    - _Requirements: 1.6, 1.7, 2.3, 2.4, 2.5_

- [x] 2. Configure ESLint
  - [x] 2.1 Add ESLint config and lint script
    - Add ESLint (Vue + TypeScript aware; `@nuxt/eslint` or `@nuxtjs/eslint-config-typescript` + `eslint-plugin-vue`) linting `.ts` and `.vue` files
    - Ensure ruleset flags style + correctness errors including `no-unused-vars` (TS-aware) and `no-undef`
    - Wire the `lint` script to exit non-zero on any violation, zero when clean
    - _Requirements: 3.1, 3.2, 3.4_

  - [x]* 2.2 Verify lint on fresh scaffold
    - Run `npm run lint` → expect zero violations, zero exit (Req 3.3)
    - Introduce a temporary unused variable, confirm non-zero exit with file/line/rule reported, then revert (Req 3.2)
    - _Requirements: 3.2, 3.3_

- [x] 3. Integrate Tailwind CSS
  - [x] 3.1 Add Tailwind module, base stylesheet, and config
    - Register `@nuxtjs/tailwindcss` in `nuxt.config.ts`
    - Create `assets/css/tailwind.css` with `@tailwind base; @tailwind components; @tailwind utilities;`
    - Register it globally via `css: ['~/assets/css/tailwind.css']`
    - Create `tailwind.config.ts` with content globs for `components`, `layouts`, `pages`, `app.vue`, `plugins`
    - _Requirements: 4.1, 4.2_

  - [x]* 3.2 Verify Tailwind output
    - Build and confirm a defined utility class emits its CSS (Req 4.3); confirm an undefined class emits nothing and build still succeeds (Req 4.4)
    - _Requirements: 4.3, 4.4_

- [x] 4. Create architecture-compliant folder structure
  - [x] 4.1 Create framework-free and reserved directories with `.gitkeep`
    - Create `engine/.gitkeep`, `engine/skills/.gitkeep`, `engine/weapons/.gitkeep`
    - Create `server/utils/.gitkeep`
    - Ensure `pages/` and `stores/` directories exist (populated in later tasks)
    - Add a short `engine/README` documenting the framework-free (zero Vue/Nuxt imports) convention
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x]* 4.2 Add folder-structure verification check
    - Assert required dirs exist (`engine/`, `engine/skills/`, `engine/weapons/`, `server/utils/`, `pages/`, `stores/`)
    - Assert `engine/` contains no `.vue` / Nuxt imports (trivially true in Phase 1; documents the invariant)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 5. Wire Pinia + persistence and the failure-notification surface
  - [x] 5.1 Register Pinia and the persistence plugin
    - Register `@pinia/nuxt` in `nuxt.config.ts`
    - Create `plugins/persistedstate.client.ts` registering `pinia-plugin-persistedstate` on the Pinia instance
    - _Requirements: 5.1, 5.2_

  - [x] 5.2 Create removable example persisted store with failure signal
    - Create `stores/example.ts`: trivial state (e.g. `visitCount`), one trivial action, `persist: true`
    - Wrap the storage-write path so a thrown write error is caught, in-memory state preserved, and a reactive `PersistenceError { failed, message }` signal set
    - No `any` types; mark the store as removable in a comment
    - _Requirements: 5.3, 5.4, 5.5_

  - [x]* 5.3 Write persistence tests
    - Changing example store state writes to localStorage (Req 5.3); reload restores it (Req 5.4)
    - Forcing a storage-write throw leaves in-memory state intact and sets the notification signal (Req 5.5)
    - _Requirements: 5.3, 5.4, 5.5_

- [x] 6. Build the portrait layout and notification region
  - [x] 6.1 Create `layouts/default.vue` portrait 9:16 + pillarbox container with notification region
    - Outer wrapper: full viewport, centered, neutral pillarbox background
    - Inner content area: `aspect-ratio: 9/16`, `overflow-y: auto`, `overflow-x: hidden`; fills width in portrait, height-driven + centered (pillarboxed) in landscape
    - Render `<slot />` for page content
    - Mount an always-present dismissible notification region observing the persistence-error signal from task 5.2
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 5.5_

  - [x]* 6.2 Write layout tests
    - Default layout applies to pages (Req 10.2)
    - Content area carries 9:16 ratio and `overflow-x: hidden` / `overflow-y: auto` classes (Req 10.1, 10.3, 10.6)
    - Snapshot the pillarbox classes (Req 10.4, 10.5)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Build the shared navigation menu
  - [x] 8.1 Create `components/NavigationMenu.vue`
    - Define a typed `readonly NavLink[]` (`{ to: string; label: string }`) with exactly one entry per non-home route: `/login`, `/register`, `/roulette`, `/versus`, `/library`, `/recordings`, `/settings`
    - Render each as a `NuxtLink` (native anchor, tabbable, Enter activates)
    - Add `keydown.space.prevent` handler so Space also navigates
    - Apply `focus-visible:` Tailwind utilities for a visible focus indicator distinct from unfocused links
    - _Requirements: 8.1, 8.2, 8.3, 9.1, 9.2, 9.3_

  - [x]* 8.2 Write navigation menu component tests
    - Renders exactly one link per non-home route (Req 8.1, 8.3)
    - Links focusable in DOM/visual order; Tab order matches (Req 9.1)
    - Each link exposes a focus-visible style class; exactly one element holds focus (Req 9.2)
    - Enter and Space on a focused link trigger navigation (Req 9.3, 8.2)
    - _Requirements: 8.1, 8.2, 8.3, 9.1, 9.2, 9.3_

- [x] 9. Add placeholder pages and not-found view
  - [x] 9.1 Create the eight placeholder pages
    - Create `pages/index.vue` (heading "Ball Battle Simulator — Home", hosts `<NavigationMenu />`), `login.vue`, `register.vue`, `roulette.vue`, `versus.vue`, `library.vue`, `recordings.vue`, `settings.vue`
    - Each is `<script setup lang="ts">`, renders a unique visible `<h1>`, no feature behavior, no network requests
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 8.1, 8.2_

  - [x] 9.2 Create catch-all not-found view
    - Create `pages/[...slug].vue` rendering a visible "Page not found" indication, not any defined page
    - Set 404 status via `setResponseStatus` on the server; no outbound requests
    - _Requirements: 7.11, 8.4_

  - [x]* 9.3 Write routing / placeholder smoke tests
    - One check per route: resolves and renders its unique heading, issues no network request (Req 7.1–7.10, 8.2)
    - Undefined route renders the not-found view and no defined page (Req 7.11, 8.4)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 8.2, 8.4_

- [x] 10. Final checkpoint - full verification
  - [x] 10.1 Run full verification suite
    - `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test` all pass with zero errors (Req 1.6, 2.5, 3.3)
    - _Requirements: 1.6, 2.5, 3.3_

  - [x] 10.2 Checkpoint - Ensure all tests pass
    - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; they are the test/verify sub-tasks.
- No property-based tests: the design's PBT assessment found Phase 1 is pure scaffolding (config, structure, static pages, layout, wiring) with no pure functions to assert universal properties over. Verification uses type-check/lint/build scripts, smoke checks, and example-based component tests.
- Dev server smoke-run (Req 1.4, 1.5) is a manual developer step in their own terminal, not a coding task, since the dev server is long-running.
- Each task references the specific requirements it satisfies for traceability.
- The example store (`stores/example.ts`) exists only to prove Pinia + persistence wiring and is removable in later phases.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "4.1"] },
    { "id": 2, "tasks": ["1.3", "2.1", "3.1", "4.2", "5.1"] },
    { "id": 3, "tasks": ["2.2", "3.2", "5.2", "8.1"] },
    { "id": 4, "tasks": ["5.3", "6.1", "8.2"] },
    { "id": 5, "tasks": ["6.2", "9.1", "9.2"] },
    { "id": 6, "tasks": ["9.3", "10.1"] }
  ]
}
```
