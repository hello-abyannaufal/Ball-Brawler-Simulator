# Ball Battle Simulator

A deterministic, seeded ball-versus-ball battle simulator built with Nuxt 3, TypeScript, and a framework-free engine core.

## Local Setup

### Prerequisites

| Tool           | Version           |
| -------------- | ----------------- |
| Node.js        | >= 18.12.0 (v24 recommended) |
| npm            | Ships with Node   |
| Docker + Compose | Any recent stable |

### 1. Install dependencies

```fish
nvm use 24
npm install
```

### 2. Set up environment variables

```fish
cp .env.example .env
```

Edit `.env` to match your local setup. The defaults work with the provided docker-compose. If port 5432 is taken, change `POSTGRES_PORT` and update `DATABASE_URL` accordingly.

### 3. Start the database

```fish
docker compose up -d
```

This starts a local PostgreSQL instance on the port defined in `.env`.

### 4. Run migrations

```fish
npm run db:migrate
```

Applies all pending migrations. Prints the count on success. On connection failure, reports the host/port attempted without leaking secrets.

### 5. Create an account

```fish
npm run user:create -- <username> <password>
```

There is no register page yet, so accounts are created from the CLI. Username: 3–20 letters, digits or underscores. Password: 8–72 characters. Every page except the splash/login requires a signed-in account.

### 6. Run the app

```fish
npm run dev
```

Opens at `http://localhost:3000`.

### 7. Run tests

```fish
npm test
```

Runs both engine (Node env, no DOM) and app (happy-dom) test suites via Vitest.

### Available scripts

| Script         | Description                         |
| -------------- | ----------------------------------- |
| `npm run dev`  | Start Nuxt dev server               |
| `npm run build`| Production build                    |
| `npm test`     | Run all tests (vitest)              |
| `npm run lint` | Lint with ESLint                    |
| `npm run db:generate` | Generate Drizzle migrations  |
| `npm run db:migrate`  | Apply pending DB migrations  |
| `npm run user:create -- <username> <password>` | Create a login account |
| `npm run sim -- [--axes weapon,race] [--runs 200]` | Balance simulation: win rates per weapon/race (`--help` for options) |

## Architecture

```
pages/ (Vue, client)          composables/ (client-only)         engine/ (pure TS)
 ├─ roulette.vue ──spinWheel──────────────────────────────────►  roulette.ts
 ├─ versus.vue ──► useVersusDuel ──createEngine / step()──────►  engine.ts ─► world, physics,
 │                  │  renderer, interpolation, FX                damage, status, cooldown,
 │                  └─ onEvent ◄──── EngineEvent ────────────────  weapons/ (registry + defs)
 │                useAudio / useRecorder (Web Audio, MediaRecorder)
 ├─ library.vue / recordings.vue / settings.vue
 ▼
stores/ (Pinia, persisted to localStorage)       server/ (Nitro API)  ─► PostgreSQL (Drizzle)
 library · roulette · settings · recordings       auth/register|login|logout, requireUser, can()
 (recording blobs live in IndexedDB)
```

| Component | Responsibility |
| --- | --- |
| `engine/` | Framework-free simulation. `createEngine(config)` builds a `World`; `step()` runs one fixed 1/60 s step: move → collide → weapon clashes → damage + knockback → status effects → win check. Emits `EngineEvent`s (`damage`, `weaponClash`, `ballDied`, `matchEnded`). No Vue/Nuxt imports, no `Math.random()`, no wall-clock. |
| `engine/weapons/` | One `WeaponDefinition` per file, validated and registered in `weaponRegistry`. Hitbox geometry lives here (`combat.ts`). |
| `engine/roulette.ts` | `spinWheel(seed, segments)`: seeded, weighted draw. See `docs/ROULETTE.md`. |
| `composables/useVersusDuel.ts` | Client driver: rAF loop (steps owed = real time × speed), interpolated rendering, hit-stop, particles, hit-flashes. Reads engine state; never writes it. |
| `composables/useAudio.ts`, `useRecorder.ts` | Synthesized sounds per event; canvas + audio capture to WebM. |
| `components/RouletteWheel.vue` | Pixel-art wheel, purely visual (lands on a result decided by the engine). |
| `stores/` | `library` (saved balls/duels), `roulette` (wheel weights), `settings` (resolution, aspect ratio, sound, speed — sanitized on load), `recordings` (metadata; blobs in IndexedDB). |
| `server/` | Auth API (`nuxt-auth-utils` sessions), `requireUser`, `can()` permission check, Drizzle schema/migrations. |

**Data flow of a duel:** the Versus page builds a `DuelConfig { engineVersion, seed, ballConfigs, arenaConfig }` → `useVersusDuel` creates the engine and steps it from `requestAnimationFrame` → each step mutates the `World` and emits events → the composable renders the world to a canvas (at the Settings resolution) and forwards events to audio, FX, and the page (HP, winner) → optionally `useRecorder` captures the canvas + audio and `stores/recordings` saves it.

## Extending

### Add a Weapon

1. Create `engine/weapons/<id>.ts` exporting a `WeaponDefinition` (`id`, `name`, `mode: 'orbit'`, `length`, `damage`, `angularSpeed`, `weight`, `hitCooldown`, `hitbox`) and call `weaponRegistry.register(def)`. Special mechanics go in `behaviors`, picked from `engine/weapons/behaviors/` (`riposte`, `reap`, `tipStrike`, `heavyBlow`, `shooter`), e.g. `behaviors: [riposte({ multiplier: 2, windowSteps: 60 })]`.
   - A new mechanic is a new behavior file implementing the hooks in `engine/weapons/behavior.ts`; the engine itself doesn't change. A behavior only touches its own weapon: other weapons reach it through generic engine concepts (clash won/lost, a projectile touching it), never by their definitions.
2. Import it in `engine/weapons/index.ts`.
3. Add its sprite to `public/sprites/weapons/<id>.png` and an entry in `assets/sprites/manifest.ts`; set `spriteId`, `pivot`, and `spriteReach` (sprite pixels from pivot to tip) so the drawn weapon matches its hitbox (check with *Show hitboxes* on `/versus`).
4. It appears automatically on the roulette Weapon wheel.

### Add a Race

1. Create `engine/races/<id>.ts` exporting a `RaceDefinition` (`id`, `name`, `maxHp`, `radius`, and the multipliers `speed`, `damageTaken`, `weaponSpin`) and call `raceRegistry.register(def)`.
2. Import it in `engine/races/index.ts`.
3. It appears automatically on the roulette Race wheel. Bump `engineVersion`.

### Add a Damage_Source

1. Add the tag to `DamageSourceTag` and `DAMAGE_SOURCE_TAGS` in `engine/damage.ts`.
2. Route the new damage through `applyDamage(world, { source: { tag }, attackerId, targetId, amount })` from the engine step (never subtract HP directly).
3. Add a hit-flash sprite (`fx:hit-<tag>` in `assets/sprites/manifest.ts`, distinct by shape) and map it in `HIT_FLASH_SPRITE` in `composables/useVersusDuel.ts`.
4. Bump `engineVersion` (see Determinism).

### Add a Skill (Trait / Ability)

The original skill system was removed for now (code in commit `548a969`). It is planned to return as **Traits** (passive, on a ball or a weapon) and **Abilities** (active, with a cooldown). Until then:

1. Agree the design first (targets, slots, compatibility, Ability triggers) — see `docs/ROULETTE.md` §5.
2. Add the definitions + registry under `engine/` (the old `engine/skills/registry.ts` + hook calls in `engine.ts` are the reference pattern; keep hooks deterministic).
3. Add a field to `BallConfig` and resolve it in `createEngine`.
4. Add a roulette step: a `WheelKind` in `stores/roulette.ts` and an entry in `STEPS` in `pages/roulette.vue`; map the pick in `saveBall()`.
5. Bump `engineVersion`.

## Determinism

- **Seeded RNG:** all engine randomness comes from `world.rng` (mulberry32, `engine/rng.ts`) created from the duel's 32-bit seed. Invalid seeds are rejected before any step.
- **Fixed timestep:** every `step()` advances exactly 1/60 s in a fixed operation order; entity iteration order is stable (by id).
- **Pure engine:** no `Math.random()`, `Date`, or `performance.now()` in `engine/`, and no framework imports. Rendering, FX, hit-stop, interpolation, and simulation speed only change *when* steps run or how they are drawn, never what a step computes.
- **Same seed + same `DuelConfig` ⇒ identical duel**, which is what makes Rematch and replays work.
- **`engineVersion`** (`engine/engine.ts`) is a string stamped into every saved `DuelConfig`. Increment it whenever a change can alter the outcome of an existing config (physics, combat, weapon stats, damage rules, RNG usage). Bump the minor version for balance/behavior changes and the major version for format changes. A saved duel whose `engineVersion` differs from the current one may not replay identically.

## Roles

- Roles are `superuser` and `viewer` (`shared/roles.ts`, DB enum in `server/db/schema.ts`). Authorization goes through one function, `can(user, action)` in `server/utils/permissions.ts`; today `superuser` may do everything and `viewer` nothing.
- Planned evolution: introduce a real permission map (which actions each role may perform), assign `viewer` to new accounts, and grant `superuser` explicitly.
- **Before any public deployment, `DEFAULT_ROLE` in `shared/roles.ts` must change from `superuser` to `viewer`.** While it is not `viewer`, every page shows a "not ready for public deployment" banner.
