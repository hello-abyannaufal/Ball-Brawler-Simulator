# Design Document: Ball Battle Simulator — Phase 1 (Scaffold)

## Overview

Phase 1 produces a Nuxt 3 + TypeScript application that is the foundation for every later phase. It contains no feature behavior: no authentication, no database, no simulation engine internals, no skills/weapons logic, no canvas, no roulette, no recording, and no settings behavior. What it does deliver is a correctly configured, type-safe, lintable, Tailwind-styled Nuxt app with Pinia + persistence wired, a folder structure that matches the long-term architecture rules, routable placeholder pages for every planned feature area, a shared keyboard-accessible navigation menu, a not-found view, and a mobile-first portrait layout baseline.

The design is deliberately minimal. Every element exists to satisfy a Phase 1 requirement or to prove that later-phase plumbing is in place (for example, one example persisted store exists only to prove Pinia persistence is wired — it holds no feature state). Nothing speculative is added.

### Scope boundaries

In scope (Phase 1):
- Nuxt 3 project setup (Vue 3 Composition API, `<script setup>`, TypeScript)
- Strict TypeScript config + type-check script
- ESLint (Vue + TypeScript) + lint script
- Tailwind CSS integration + base stylesheet
- Pinia + `pinia-plugin-persistedstate` via a Nuxt plugin; one example persisted store stub
- Architecture-compliant folder structure (`engine/`, `engine/skills/`, `engine/weapons/`, `server/utils/`, `pages/`, `stores/`)
- Placeholder pages for `/`, `/login`, `/register`, `/roulette`, `/versus`, `/library`, `/recordings`, `/settings`
- Catch-all not-found view
- Shared `Navigation_Menu` component (one link per route, keyboard accessible, visible focus)
- Mobile-first portrait layout (default 9:16, pillarboxed on landscape) via `layouts/default.vue`
- Persistence write-failure notification surface

Out of scope (later phases): auth, Drizzle/PostgreSQL, engine internals, skills/weapons definitions, canvas rendering, roulette logic, recording/audio, settings behavior, server sync.

### Node engine requirement

Nuxt 3 (3.x) targets Node `^18.12 || ^20.9 || >=22.11`. The scaffold's `package.json` SHALL declare an `engines.node` field constraining to a supported range (`>=18.12.0`). The developer environment manages Node via nvm; a satisfying installed version (for example v18.20.8, v22.22.2, or v24.13.1) must be selected with `nvm use <version>` before `npm install`, dev, build, type-check, or lint. The engine requirement is documented so tooling choices stay valid; no Node version is hardcoded into committed source.

## Architecture

### High-level structure

Nuxt 3 provides the build system (Vite + Nitro), file-based routing, layouts, auto-imports, and the plugin system. The scaffold layers the following on top:

- **Styling**: `@nuxtjs/tailwindcss` module generates the Tailwind stylesheet and injects utilities app-wide.
- **State**: `@pinia/nuxt` registers Pinia; a Nuxt client plugin registers `pinia-plugin-persistedstate`.
- **Layout**: a single `layouts/default.vue` enforces the portrait 9:16 content area and pillarboxing.
- **Routing**: `pages/` provides file-based routes; `pages/[...slug].vue` is the catch-all not-found view.
- **Navigation**: a shared `components/NavigationMenu.vue` renders exactly one link per route and is keyboard accessible.

```mermaid
graph TD
    subgraph Nuxt3[Nuxt 3 App]
        Config[nuxt.config.ts]
        Layout[layouts/default.vue<br/>portrait 9:16 + pillarbox]
        subgraph Pages[pages/ file-based routing]
            Home[index.vue /]
            Auth[login.vue, register.vue]
            Feat[roulette, versus, library,<br/>recordings, settings]
            NotFound[&#91;...slug&#93;.vue catch-all]
        end
        Nav[components/NavigationMenu.vue<br/>one link per route, a11y]
        subgraph Plugins[plugins/]
            PersistPlugin[persistedstate.client.ts]
        end
        subgraph Stores[stores/]
            ExampleStore[example.ts persisted stub]
        end
    end
    subgraph Modules[Nuxt Modules]
        Tailwind[@nuxtjs/tailwindcss]
        PiniaMod[@pinia/nuxt]
    end
    subgraph FrameworkFree[Framework-free dirs - empty in Phase 1]
        Engine[engine/ + skills/ + weapons/]
        ServerUtils[server/utils/]
    end

    Config --> Tailwind
    Config --> PiniaMod
    PiniaMod --> PersistPlugin
    PersistPlugin --> ExampleStore
    Layout --> Pages
    Home --> Nav
    Nav --> Pages
```

### Framework-free engine boundary (Architecture rule 1)

`engine/`, `engine/skills/`, and `engine/weapons/` exist in Phase 1 but hold no source files — only `.gitkeep` markers. This satisfies the "directory exists even when empty" requirements and reserves the locations. Because they contain zero TypeScript source in Phase 1, they trivially contain zero Vue/Nuxt imports. A documented convention (README + a lint boundary noted in Testing Strategy) will keep `engine/` framework-free as later phases add code. Phase 1 does not add an enforced import-boundary lint rule beyond documentation, since there is nothing yet to guard; this keeps the scaffold minimal.

### Rendering mode

The app runs with Nuxt defaults (SSR enabled). Placeholder pages render static content and issue no network requests. Persistence and the persistence plugin are client-only (localStorage is a browser API), so the persistedstate plugin is registered as a `.client` plugin and the example store reads/writes storage only in the browser.

### Directory layout

```
BallBrawler/
├─ nuxt.config.ts
├─ tsconfig.json
├─ package.json
├─ .eslintrc.cjs            (or eslint.config.mjs — flat config)
├─ tailwind.config.ts
├─ app.vue                   (renders <NuxtLayout><NuxtPage/></NuxtLayout>)
├─ assets/
│  └─ css/
│     └─ tailwind.css        (base stylesheet: @tailwind directives)
├─ components/
│  └─ NavigationMenu.vue
├─ layouts/
│  └─ default.vue            (portrait 9:16 + pillarbox container)
├─ pages/
│  ├─ index.vue              (/)  Home_Menu, hosts NavigationMenu
│  ├─ login.vue              (/login)
│  ├─ register.vue           (/register)
│  ├─ roulette.vue           (/roulette)
│  ├─ versus.vue             (/versus)
│  ├─ library.vue            (/library)
│  ├─ recordings.vue         (/recordings)
│  ├─ settings.vue           (/settings)
│  └─ [...slug].vue          (catch-all not-found view)
├─ plugins/
│  └─ persistedstate.client.ts   (registers pinia-plugin-persistedstate)
├─ stores/
│  └─ example.ts             (persisted store stub — proves wiring only)
├─ server/
│  └─ utils/
│     └─ .gitkeep
└─ engine/
   ├─ .gitkeep
   ├─ skills/
   │  └─ .gitkeep
   └─ weapons/
      └─ .gitkeep
```

Note on `app.vue`: including an explicit `app.vue` that wraps `<NuxtPage/>` in `<NuxtLayout>` guarantees `layouts/default.vue` applies as the baseline for every page (Requirement 10.2) without each page opting in.

## Components and Interfaces

### `nuxt.config.ts`

Central configuration. Responsibilities:
- Enable TypeScript type checking (`typescript.typeCheck` via `vue-tsc`, `typescript.strict: true`).
- Register modules: `@nuxtjs/tailwindcss`, `@pinia/nuxt`.
- Register the global Tailwind base stylesheet (`css: ['~/assets/css/tailwind.css']`).
- Keep SSR default; no runtime config needed in Phase 1.

### `tsconfig.json`

Extends Nuxt's generated `./.nuxt/tsconfig.json` and asserts strict settings. Nuxt's generated config already sets `strict: true`; the project tsconfig makes strictness explicit and may add `noUncheckedIndexedAccess` and `noImplicitOverride` for extra safety. Governs all `.ts` and `.vue` files via `vue-tsc`.

### ESLint config

Uses `@nuxt/eslint` (or `@nuxtjs/eslint-config-typescript` + `eslint-plugin-vue`) to lint `.ts` and `.vue` files. Ruleset flags code-style violations and correctness errors including `no-unused-vars` (TypeScript-aware) and `no-undef`. A `lint` script runs ESLint over the project; it exits non-zero on any violation and zero when clean.

### `assets/css/tailwind.css`

Base stylesheet containing the Tailwind directives:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```
Registered globally so utilities are available to every page without per-page imports.

### `tailwind.config.ts`

Content globs cover `./components/**/*.{vue,ts}`, `./layouts/**/*.vue`, `./pages/**/*.vue`, `./app.vue`, and `./plugins/**/*.ts`. No custom theme in Phase 1 beyond defaults.

### `layouts/default.vue`

Enforces the mobile-first portrait baseline:
- Outer wrapper: full viewport, flexbox centering, a neutral "pillarbox" background outside the content area.
- Inner content area: `aspect-ratio: 9 / 16`, constrained so that in a portrait viewport (taller than wide) it fills available width with no horizontal overflow, and in a landscape viewport (wider than tall) it is sized by height and centered, producing pillarbox bars on the sides.
- Content inside the fixed-ratio block scrolls vertically when it overflows; horizontal overflow is suppressed.

Interface: renders `<slot />` for page content.

Approach: a centered container using `max-width` tied to viewport height for landscape and `width: 100%` for portrait, with `aspect-ratio: 9/16`, `overflow-y: auto`, `overflow-x: hidden`. This yields:
- Portrait viewport: content area width = viewport width, height follows ratio, no horizontal scroll (Req 10.3).
- Landscape viewport: content area height = viewport height, width = height × 9/16, centered → side pillarbox bars; all content and links remain visible and activatable (Req 10.4).

### `components/NavigationMenu.vue`

Shared menu rendering exactly one link per non-home route: `/login`, `/register`, `/roulette`, `/versus`, `/library`, `/recordings`, `/settings` (seven links; the Home menu links out to every other area per Req 8.1). Rendered on the Home menu (`pages/index.vue`).

Design details:
- Each link is a `NuxtLink` (renders an `<a>` with `href`), so Enter activates natively and the element is in the tab order. `NuxtLink` performs client-side navigation on activation (Req 8.2, 9.3).
- Links are driven by a typed array of `{ to: string; label: string }` so each route appears exactly once (Req 8.1) and the set is defined in one place.
- Keyboard: native anchors are tabbable; Tab/Shift+Tab move focus in DOM order which matches visual order (Req 9.1). Enter activates anchors natively; Space is handled by adding a `keydown.space.prevent` handler that triggers navigation so Space also activates (Req 9.3).
- Focus: a visible focus style via Tailwind `focus-visible:` utilities (ring/outline) distinct from unfocused links; because the browser gives focus to exactly one element at a time, exactly one link shows the indicator (Req 9.2).

Interface (props): none in Phase 1 — the route list is internal. Keeping it prop-free matches the minimal scope.

### Placeholder pages (`pages/*.vue`)

Each page is a `<script setup lang="ts">` component that renders a unique, visible `<h1>` heading identifying its route and no feature behavior and no network requests (Req 7.10). Headings:

| Route | Heading text |
|-------|--------------|
| `/` | Ball Battle Simulator — Home |
| `/login` | Login |
| `/register` | Register |
| `/roulette` | Roulette |
| `/versus` | Versus |
| `/library` | Library |
| `/recordings` | Recordings |
| `/settings` | Settings |

`pages/index.vue` additionally hosts `<NavigationMenu />`.

### `pages/[...slug].vue` — not-found view

Nuxt catch-all route. Renders a placeholder not-found view with a visible indication that the route does not exist (e.g. heading "Page not found"). It does not render any defined route's placeholder page. This covers both direct-URL entry of an undefined route and any menu link that fails to resolve (Req 7.11, 8.4). The page sets a 404 status via `setResponseStatus` on the server for correctness, with no outbound data requests.

### `plugins/persistedstate.client.ts`

Client-only Nuxt plugin. Obtains the Pinia instance from the Nuxt app and registers `pinia-plugin-persistedstate` on it so stores declaring `persist` persist to localStorage. Client-only because localStorage is browser-only.

### `stores/example.ts` — persisted store stub

A minimal Pinia store that exists only to prove persistence wiring (Req 5 proof). It holds a trivial state value (for example a `lastVisited` string or a counter) and enables `persist`. It contains no feature logic and will be removed or replaced when real stores (`library`, `settings`, `recordings`) arrive in later phases. The store also exposes the persistence-failure signal used by the notification surface (see Data Models and Error Handling).

### Persistence write-failure notification surface

To satisfy Req 5.5, the scaffold needs a user-visible signal when a localStorage write fails (e.g. quota exceeded, storage disabled). Design:
- The persistedstate plugin / store wraps the storage write path so a thrown error during persistence is caught, the in-memory state is left intact, and a reactive "persistence error" flag/message is set.
- A small, always-mounted UI element in `layouts/default.vue` (a dismissible banner/toast region) observes that flag and renders a visible notification when set. In Phase 1 this surface is only exercised by the example store but is wired app-wide via the layout so later stores reuse it.

This is the one piece of behavior Phase 1 implements beyond static placeholders, and it exists solely because Req 5.5 mandates a user-visible failure indication.

## Data Models

Phase 1 has essentially no domain data. The only models are configuration shapes and the trivial example store state.

### Navigation link model (internal to `NavigationMenu.vue`)

```ts
interface NavLink {
  readonly to: string;   // route path, e.g. "/login"
  readonly label: string; // visible link text
}
```
A single `readonly NavLink[]` lists each of the seven non-home routes exactly once.

### Example persisted store state

```ts
interface ExampleState {
  // trivial value to demonstrate persistence; no feature meaning
  visitCount: number;
}
```
Store enables persistence:
```ts
// stores/example.ts (shape)
export const useExampleStore = defineStore('example', {
  state: (): ExampleState => ({ visitCount: 0 }),
  actions: { /* trivial increment to trigger a persisted write */ },
  persist: true,
});
```

### Persistence error signal

```ts
interface PersistenceError {
  readonly failed: boolean;
  readonly message: string; // human-readable reason surfaced in the UI
}
```
Held in a small composable or store slice and read by the layout's notification region. No `any` types are used anywhere; all shapes are explicit.

## Error Handling

Phase 1 error handling is limited to tooling behavior and the one mandated runtime case.

- **Dev server start failure (Req 1.5)**: handled by Nuxt/Nitro — a failed `dev` exits non-zero and prints the error. No custom handling added.
- **Production build failure (Req 1.7)**: handled by Nuxt build — a failed `build` exits non-zero, prints the error, and does not report success. Build success is judged solely by the build script's exit status/output. No custom handling added.
- **Type-check failures (Req 2.3)**: `vue-tsc` reports errors and exits non-zero; zero errors exits zero (Req 2.4). No custom handling added.
- **Lint failures (Req 3.2)**: ESLint reports file/line/rule per violation and exits non-zero; clean run exits zero (Req 3.3). Missing/invalid lint config causes a non-zero exit with an error (Req 3.4) — ESLint's native behavior.
- **Unknown Tailwind class (Req 4.4)**: Tailwind simply emits no CSS for undefined class names and the build still succeeds — native behavior, no handling added.
- **Not-found route (Req 7.11, 8.4)**: the `[...slug].vue` catch-all renders the not-found view instead of any defined page.
- **Persistence write failure (Req 5.5)**: caught at the storage-write boundary; in-memory state preserved; a reactive error signal set; the layout's notification region renders a visible message. This is the only custom runtime error handling in Phase 1.

## Testing Strategy

### PBT applicability assessment

Property-based testing is **not applicable** to Phase 1. The phase is pure scaffolding: framework configuration (Nuxt, TypeScript, ESLint, Tailwind, Pinia), directory structure, static placeholder pages, UI layout, and wiring. None of these are pure functions with meaningful input variation where "for all inputs X, property P(X) holds" produces value. Per the workflow's PBT guidance, config/IaC-like setup, UI rendering/layout, and plumbing use snapshot/example/smoke tests, not PBT. Therefore the **Correctness Properties section is intentionally omitted** and the testing strategy below uses verification scripts, smoke checks, and example-based component tests.

Later phases that introduce the engine (seeded RNG, fixed-timestep simulation, collision math, `applyDamage`, serialization of duels) are the natural home for property-based tests (determinism, round-trip of saved duels, invariants). Phase 1 lays no such logic.

### Verification approach (maps to acceptance criteria)

1. **Build-system smoke checks (Req 1, 2, 3, 4)** — run as scripts, each judged by exit status:
   - `dev`: starts, becomes reachable at a local URL, zero startup errors (manual/one-shot smoke; developer runs it in their own terminal since dev server is long-running).
   - `build`: completes, produces output, zero errors; non-zero on failure.
   - `typecheck` (`nuxi typecheck` / `vue-tsc --noEmit`): zero errors on the fresh scaffold.
   - `lint`: zero violations on the fresh scaffold; non-zero when a violation is introduced.
   - Tailwind: a known utility class on a page produces its CSS in build output; an undefined class emits nothing and build still succeeds.

2. **Routing / placeholder smoke tests** — one example-based check per route confirming the route resolves and renders its unique heading and issues no network request (Req 7.1–7.10, 8.2). One check that an undefined route renders the not-found view and no defined page (Req 7.11, 8.4).

3. **Navigation menu component tests (example-based, @nuxt/test-utils + Vitest + Vue Test Utils)**:
   - Renders exactly one link per non-home route (Req 8.1, 8.3).
   - Links are focusable in DOM/visual order; Tab order matches (Req 9.1) — asserted via tab index / DOM order.
   - Each link exposes a focus-visible style class and only one element can hold focus (Req 9.2).
   - Enter and Space on a focused link trigger navigation (Req 9.3, 8.2).

4. **Layout tests (example-based / snapshot)**:
   - Default layout applies to pages (Req 10.2).
   - Content area carries the 9:16 ratio and `overflow-x: hidden` / `overflow-y: auto` classes (Req 10.1, 10.3, 10.6).
   - Pillarbox behavior in landscape is driven by CSS; verified by snapshot of the layout classes and a manual responsive check (Req 10.4, 10.5).

5. **Persistence tests (example-based)**:
   - Changing the example store's state writes to localStorage (Req 5.3); reloading restores it (Req 5.4).
   - Forcing a storage-write throw leaves in-memory state intact and sets the user-visible notification (Req 5.5).

6. **Folder-structure checks**: assert the required directories exist (`engine/`, `engine/skills/`, `engine/weapons/`, `server/utils/`, `pages/`, `stores/`) and that `engine/` contains no `.vue`/Nuxt imports (trivially true in Phase 1 — a simple grep-style check documents the invariant for later phases) (Req 6.1–6.7, 6.2).

### Tooling

- **Test runner**: Vitest with `@nuxt/test-utils` for component/route tests.
- **Scripts** (in `package.json`): `dev`, `build`, `preview`, `typecheck`, `lint`, `test`.
- Minimum iteration counts and property tagging do not apply (no PBT in Phase 1).

## Design-to-Requirements Traceability

| Requirement | Design element(s) |
|-------------|-------------------|
| 1.1 Nuxt 3 / Vue 3 Composition API | Nuxt 3 project, `nuxt.config.ts` |
| 1.2 `<script setup>` | All pages/components authored with `<script setup lang="ts">` |
| 1.3 TypeScript | `tsconfig.json`, `.ts`/`lang="ts"` throughout |
| 1.4 Dev server starts, reachable, zero errors | `dev` script (Nuxt/Nitro); Testing Strategy §1 |
| 1.5 Dev start failure → non-zero + error | Error Handling (Nuxt native); `dev` script |
| 1.6 Build completes, output, zero errors, judged by build only | `build` script; Testing Strategy §1 |
| 1.7 Build failure → non-zero + error, not success | Error Handling (Nuxt native) |
| 2.1 Strict type checking all `.ts`/`.vue` | `tsconfig.json` strict; `nuxt.config.ts` typescript options |
| 2.2 Type-check command checks all files | `typecheck` script (`vue-tsc`) |
| 2.3 Type errors → report + non-zero | Error Handling; `typecheck` |
| 2.4 Zero errors → zero exit | `typecheck` |
| 2.5 Fresh scaffold passes type-check | Minimal typed scaffold; Testing Strategy §1 |
| 3.1 Lint ruleset over `.ts`/`.vue`, style+correctness | ESLint config |
| 3.2 Violations → file/line/rule + non-zero | ESLint native; `lint` script |
| 3.3 Fresh scaffold lint clean → zero exit | `lint`; Testing Strategy §1 |
| 3.4 Missing/invalid config → non-zero + error | ESLint native |
| 4.1 Tailwind utilities app-wide, no per-page config | `@nuxtjs/tailwindcss`, global `assets/css/tailwind.css` |
| 4.2 Stylesheet generated without error on dev/build | Tailwind module in `nuxt.config.ts` |
| 4.3 Defined utility → its CSS in output | `tailwind.config.ts` content globs; Testing Strategy §1 |
| 4.4 Undefined class → no CSS, build still succeeds | Tailwind native; Error Handling |
| 5.1 Register Pinia | `@pinia/nuxt` |
| 5.2 Register persistence plugin | `plugins/persistedstate.client.ts` |
| 5.3 Persisted store change → write to localStorage | `stores/example.ts` `persist: true`; Testing Strategy §5 |
| 5.4 On load → restore from localStorage | persistedstate plugin; Testing Strategy §5 |
| 5.5 Write failure → keep state + user-visible notification | Persistence failure surface; layout notification region; Error Handling |
| 6.1 `engine/` exists when empty | `engine/.gitkeep` |
| 6.2 `engine/` zero Vue/Nuxt imports at any depth | Framework-free boundary; empty in Phase 1; structure check |
| 6.3 `engine/skills/` exists when empty | `engine/skills/.gitkeep` |
| 6.4 `engine/weapons/` exists when empty | `engine/weapons/.gitkeep` |
| 6.5 `server/utils/` exists when empty | `server/utils/.gitkeep` |
| 6.6 `pages/` exists when empty | `pages/` (populated) |
| 6.7 `stores/` exists when empty | `stores/` (holds example stub) |
| 7.1–7.8 Pages at the eight routes | `pages/index.vue`, `login.vue`, `register.vue`, `roulette.vue`, `versus.vue`, `library.vue`, `recordings.vue`, `settings.vue` |
| 7.9 Direct nav renders that route's page | Nuxt file-based routing |
| 7.10 Unique visible heading, no network requests | Per-page `<h1>` table; static pages |
| 7.11 Undefined route → not-found view, no defined page | `pages/[...slug].vue` |
| 8.1 Home links once to each of 7 routes | `NavigationMenu.vue` typed `NavLink[]` |
| 8.2 Activate link → navigate + render page | `NuxtLink` client navigation |
| 8.3 Direct link to every route, no prior visit needed | File-based routing + menu links |
| 8.4 Unresolved target (menu or URL) → visible unavailable indication | `pages/[...slug].vue` not-found view |
| 9.1 Tab / Shift+Tab move focus in visual order | Native anchors (`NuxtLink`) in DOM order |
| 9.2 Visible focus indicator on exactly one link | `focus-visible:` Tailwind utilities; browser single-focus |
| 9.3 Enter / Space activate focused link | Native Enter + `keydown.space.prevent` handler |
| 10.1 Default aspect ratio 9:16 | `layouts/default.vue` content area `aspect-ratio: 9/16` |
| 10.2 Baseline layout for every page | `app.vue` wraps `<NuxtPage/>` in `<NuxtLayout>`; `default.vue` |
| 10.3 Portrait → fits width, no horizontal scroll | Layout container width rules; `overflow-x: hidden` |
| 10.4 Landscape → fixed-ratio pillarboxed, no clipping, links activatable | Layout height-driven sizing + centered pillarbox |
| 10.5 Heading + links legible, no overlap | Layout spacing; Testing Strategy §4 |
| 10.6 Overflow → vertical scroll only | `overflow-y: auto`, `overflow-x: hidden` |

## Design Decisions and Rationale

- **Explicit `app.vue` wrapping `<NuxtLayout>`**: guarantees the portrait layout is the baseline for every route (Req 10.2) without each page opting in — the single enforcement point keeps it from being forgotten.
- **`.gitkeep` for empty architecture dirs**: satisfies "directory exists even when empty" (Req 6.1, 6.3, 6.4, 6.5) and reserves framework-free locations without adding placeholder source that could violate the zero-import rule (Req 6.2).
- **One example persisted store, removable later**: the minimum needed to prove Pinia + persistence wiring (Req 5). It carries no feature meaning so it imposes nothing on later store design.
- **Native anchors (`NuxtLink`) for the menu**: free Tab order, Enter activation, and screen-reader semantics (Req 9.1, 9.3); only Space needs a small added handler. Avoids reimplementing roving-tabindex, which the requirements do not call for.
- **Persistence failure surfaced via a layout-level notification region**: Req 5.5 mandates a user-visible indication; mounting it in the layout means later stores reuse the same surface without rework.
- **No engine import-boundary lint rule yet**: there is no engine code to guard in Phase 1, so the rule would be dead weight; the constraint is documented and enforced when `engine/` gains source.
- **Node engine range declared, not pinned to one version**: keeps the scaffold portable across the developer's nvm-managed versions while documenting the supported range so a compatible version is chosen before install.
