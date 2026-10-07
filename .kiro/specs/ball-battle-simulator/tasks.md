# Implementation Plan: Ball Battle Simulator — Phases 2–9

## Overview

This plan converts the design into incremental coding tasks that build on the completed Phase 1 scaffold (Nuxt 3 + TypeScript, Tailwind, Pinia + persist, folder tree, eight routable placeholder pages, keyboard-accessible menu, portrait 9:16 layout). It does NOT re-create any scaffold.

Build order follows Phases 2–9. The engine (`engine/`) stays framework-free, deterministic, pure TypeScript — zero Vue/Nuxt imports, no `Math.random`, no wall-clock. Engine tests are framework-free (plain Vitest, no DOM). Property-based tests use `fast-check` with a minimum of 100 iterations each, tagged `// Feature: ball-battle-simulator, Property {n}: ...`, and assert against the real engine. The 34 correctness properties from the design map to exactly one property test each; app-layer example/integration/smoke tests cover the rest.

Each test sub-task marked `*` is optional and may be skipped for a faster MVP. Core implementation sub-tasks are never optional.

## Tasks

- [x] 1. Phase 2 — Add dependencies and test config
  - [x] 1.1 Install new dependencies and create Vitest config
    - Select a satisfying installed Node version with `nvm use <version>` before installing (package.json requires `>=18.12.0`).
    - Add runtime deps `nuxt-auth-utils`, `drizzle-orm`, `postgres`; add dev deps `drizzle-kit`, `fast-check`.
    - Create `vitest.config.ts` with two project environments: `node` for `engine/**` (no DOM) and `happy-dom` for app/component tests. Wire `npm run test` to `vitest run`.
    - _Requirements: 5.1, 5.3_

- [ ] 2. Phase 2 — Database schema, migrations, and local DB setup
  - [x] 2.1 Define Drizzle schema and client
    - Create `server/db/schema.ts`: `role` pgEnum (`superuser` | `viewer`), `users` table (`id` uuid PK, `email` text not null unique, `password_hash` text not null, `role` enum not null, `created_at` timestamptz not null default now). Add a commented example content table showing the `created_by` not-null FK → `users.id` pattern.
    - Create `server/db/client.ts`: `postgres` driver + Drizzle client reading connection from env.
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 2.2 Add migration generation and apply script with timeout handling
    - Configure `drizzle.config.ts` to emit migrations into `server/db/migrations/`.
    - Create a `db:migrate` script that connects with a 10-second timeout, applies pending migrations, and prints a completion message naming the count. On connection failure: terminate without changing data and print the host and port attempted; never log secrets.
    - _Requirements: 1.5, 1.8, 1.9_
  - [x] 2.3 Add docker-compose and env example
    - Create `docker-compose.yml` starting one local PostgreSQL instance on a configured host/port.
    - Create `.env.example` listing every variable required to connect to PostgreSQL and run the Auth_Service, each with a non-secret placeholder.
    - _Requirements: 1.6, 1.7_
  - [ ]* 2.4 Write integration/smoke tests for schema and migrations
    - Against the docker-compose Postgres: assert schema, columns, email uniqueness, role enum values, and the `created_by` FK exist; `db:migrate` applies pending migrations and reports the count; bad host/port triggers connection-failure handling leaving data unchanged. 1–3 examples, not property iterations.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.8, 1.9_

- [x] 3. Phase 2 — Auth service, session, authorization, and middleware
  - [x] 3.1 Implement centralized authorization utilities
    - Create `server/utils/permissions.ts`: `can(user, permission)` returns true for `superuser`, false otherwise; export `AuthedUser` and a single `DEFAULT_ROLE` constant. Include a clearly marked TODO: before public deployment, default role must become `viewer` and a real permission map must be defined.
    - Create `server/utils/requireUser.ts`: returns the authenticated User for a valid, unexpired session; otherwise throws 401 without returning a User and without changing server state.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  - [ ]* 3.2 Write property test for authorization
    - **Property 33: Authorization resolves solely from role and permission**
    - **Validates: Requirements 4.4, 4.5**
  - [x] 3.3 Implement password-length validation helper
    - Create a pure validator used by register: accept length only when 8–72 inclusive, reject otherwise with a length error.
    - _Requirements: 2.7_
  - [ ]* 3.4 Write property test for password length validation
    - **Property 32: Password length validation**
    - **Validates: Requirements 2.7**
  - [x] 3.5 Implement register endpoint
    - Create `server/api/auth/register.post.ts`: validate email syntax and password length; reject duplicate email (409, create no row), missing fields (validation error naming each), invalid email format. On success: `hashPassword` via `nuxt-auth-utils`, insert User with `role='superuser'` and `created_at` = server UTC, store only the hash, then `setUserSession({ id, role })`. Include a clearly marked TODO: default role must become `viewer` before public deployment.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 2.9_
  - [x] 3.6 Implement login and logout endpoints
    - Create `server/api/auth/login.post.ts`: verify hash; on success `setUserSession({ id, role })`. On bad email or password return a single generic error that does not disclose which was wrong; missing fields → validation error naming each.
    - Create `server/api/auth/logout.post.ts`: `clearUserSession`. Session carries `{ id, role }` with role constrained to `superuser | viewer` and restores on reload.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7_
  - [x] 3.7 Implement protected-route middleware and deployment-safety notice
    - Create route middleware that prevents rendering of auth-required pages for unauthenticated visitors and redirects to `/login`.
    - In `layouts/default.vue`, render a persistent visible banner on every page while `DEFAULT_ROLE` is not `viewer`, stating the app is not ready for public deployment.
    - _Requirements: 3.6, 4.8, 17.6_
  - [ ]* 3.8 Write unit tests for auth flow
    - Register creates a `superuser` with a hash and never stores plaintext; duplicate-email, missing-field, and invalid-email rejections; login success/failure with generic error; logout clears session; session restore on reload; `requireUser` returns/rejects; `can` returns a boolean; TODO markers present in register handler and `permissions.ts`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 2.9, 4.7_

- [x] 4. Phase 2 — README setup section
  - [x] 4.1 Write README local setup section
    - Document prerequisite tooling with required versions, dependency install steps, docker-compose + migrate steps, and the exact command to run the app locally.
    - _Requirements: 17.2_

- [x] 5. Checkpoint — Phase 2 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Phase 3 — Engine RNG and seed validation
  - [x] 6.1 Implement mulberry32 RNG with seed validation
    - Create `engine/rng.ts`: `SEED_MIN`/`SEED_MAX`, `createRng(seed)` throwing `InvalidSeedError` for non-integer or out-of-range `[0, 4294967295]` seeds before any use; `next()`, `nextInt(n)`, readonly `state`. No `Math.random`, no wall-clock.
    - _Requirements: 5.2, 5.9_
  - [ ]* 6.2 Write property test for invalid-seed rejection
    - **Property 3: Invalid seeds are rejected before any step**
    - **Validates: Requirements 5.2, 5.9**

- [x] 7. Phase 3 — World, entities, and config types
  - [x] 7.1 Define entity and config types and the World container
    - Create `engine/entities.ts` (`Vec2`, `BaseEntity`, `Ball`, `Projectile`, `WeaponEntity`, `Entity`, `EntityId`, `EntityKind`) and `engine/world.ts` (`World` with stable insertion-ordered `entities`, `rng`, `arena`, `tick`, `add`, `ballById`, `aliveBalls`).
    - Create `engine/config.ts`: `DuelConfig`, `BallConfig`, `ArenaConfig`, `SkillRef`, `WeaponRef`.
    - _Requirements: 5.5_

- [x] 8. Phase 3 — Damage gateway and Damage_Source union
  - [x] 8.1 Implement events and the Damage_Source union
    - Create `engine/events.ts` (`EngineEvent`: `damage`, `skillTriggered`, `weaponClash`, `ballDied`, `matchEnded`).
    - Create `engine/damage.ts` types: `DamageSourceTag` with active members `contact`/`weapon`/`projectile` and reserved `area`/`dot`/`environment`/`beam`/`summon`/`reflect`; `DamageSource`, `DamageFlags`, `ApplyDamageInput`, `ApplyDamageOutcome`.
    - _Requirements: 6.4, 6.5_
  - [x] 8.2 Implement the applyDamage gateway
    - Create `applyDamage(world, input)` as the only HP reducer: amount ≤ 0 → no change, no event, `noop`; target not a living ball → `target-not-found`; source tag outside the union → `invalid-source`; empty `attackerId` allowed; `summonOwnerId` credits owner; `isReflected` applies once and triggers no further reflection; positive application emits exactly one `damage` event; HP ≤ 0 clamps to 0, marks dead, emits exactly one `ballDied`.
    - _Requirements: 6.1, 6.2, 6.3, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11_
  - [ ]* 8.3 Write property test for valid damage application
    - **Property 4: Valid damage application is the single HP-reduction path**
    - **Validates: Requirements 6.1, 6.7, 6.10**
  - [ ]* 8.4 Write property test for no-op damage inputs
    - **Property 5: Invalid or no-op damage inputs change nothing**
    - **Validates: Requirements 6.2, 6.3, 6.6**
  - [ ]* 8.5 Write property test for HP floor and single kill
    - **Property 6: HP never goes negative; reaching zero kills exactly once**
    - **Validates: Requirements 6.11**
  - [ ]* 8.6 Write property test for non-reflecting reflected damage
    - **Property 7: Reflected damage cannot reflect again**
    - **Validates: Requirements 6.9**
  - [ ]* 8.7 Write unit tests for damage union and crediting
    - Damage_Source union lists active and reserved members (6.4, 6.5); summon crediting via `summonOwnerId` (6.8).
    - _Requirements: 6.4, 6.5, 6.8_

- [x] 9. Phase 3 — Status effects and hit cooldowns
  - [x] 9.1 Implement status-effect system
    - Create `engine/status.ts`: `StatusEffect` (`remaining` ≥ 0 whole timesteps, `tickInterval` ≥ 1, `sinceLastTick`, `onTick`); `runStatusEffects(world)` decrements duration by one per step, fires tick once each time `sinceLastTick` reaches the interval (resetting it), removes the effect when duration reaches zero.
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 9.2 Implement hit-cooldown table
    - Create `engine/cooldown.ts`: `CooldownTable` keyed by ordered `(attackerId, targetId)` pair with `isActive`, `start(duration)`, `decrementAll()` (one timestep per step). While active, a repeated hit for the pair applies no damage, knockback, or status change.
    - _Requirements: 7.5, 7.6, 7.7, 7.8_
  - [ ]* 9.3 Write property test for status-effect lifecycle
    - **Property 8: Status-effect lifecycle**
    - **Validates: Requirements 7.2, 7.3, 7.4**
  - [ ]* 9.4 Write property test for hit cooldown
    - **Property 9: Hit cooldown prevents repeat interactions**
    - **Validates: Requirements 7.7, 7.8, 10.7**

- [x] 10. Phase 3 — Ball and arena physics
  - [x] 10.1 Implement physics and collision math
    - Create `engine/physics.ts`: `resolveWallCollision` (negate normal component, reposition tangent, keep ball in bounds, return true on bounce); `ballsOverlap`; `separateBalls` (push apart along center line until tangent); `applyKnockback` (impulse along striker→struck center line). Hand-written circle math, no physics library.
    - _Requirements: 8.1, 8.2, 8.4, 8.6_
  - [ ]* 10.2 Write property test for free-flight integration
    - **Property 10: Free-flight integration**
    - **Validates: Requirements 8.1**
  - [ ]* 10.3 Write property test for wall containment
    - **Property 11: Walls contain the ball**
    - **Validates: Requirements 8.2**
  - [ ]* 10.4 Write property test for ball separation
    - **Property 13: Ball separation restores tangency**
    - **Validates: Requirements 8.4**

- [x] 11. Phase 3 — Engine step loop, win condition, and engineVersion
  - [x] 11.1 Implement the engine lifecycle and fixed-order step
    - Create `engine/engine.ts`: `engineVersion` (non-empty string), `TIMESTEP = 1/60`, `EngineOptions`, `Engine`, `createEngine(opts)` (builds World from config, validates seed, resolves skill/weapon ids). `step()` runs the seven operations exactly once each in order: (1) move balls+weapons, (2) detect collisions, (3) resolve weapon clashes, (4) apply damage, (5) apply knockback, (6) run status effects, (7) check win condition. Wire wall-bounce to fire `onWallBounce` once per bounce; contact collisions route through `applyDamage` with source `contact` and start the pair cooldown; emit `matchEnded` for one-alive winner, zero-alive null winner, never while ≥2 alive.
    - _Requirements: 5.4, 5.5, 5.7, 5.8, 8.3, 8.5, 8.7, 8.8, 8.9_
  - [ ]* 11.2 Write property test for fixed step order
    - **Property 2: Fixed step order**
    - **Validates: Requirements 5.7, 7.9**
  - [ ]* 11.3 Write property test for determinism
    - **Property 1: Determinism of seed and config**
    - **Validates: Requirements 5.5, 5.6, 11.10**
  - [ ]* 11.4 Write property test for contact collision damage and knockback
    - **Property 14: Contact collision applies damage once and knockback along the center line**
    - **Validates: Requirements 8.5, 8.6**
  - [ ]* 11.5 Write property test for wall-bounce hook firing
    - **Property 12: Wall bounce triggers the hook exactly once**
    - **Validates: Requirements 8.3**
  - [ ]* 11.6 Write property test for win condition
    - **Property 15: Win condition**
    - **Validates: Requirements 8.7, 8.8, 8.9**
  - [ ]* 11.7 Write determinism and engine unit tests
    - Fixed-config, fixed-seed run twice to completion asserting byte-identical winner + every final HP (5.6); `engineVersion` non-empty (5.8); `TIMESTEP` equals 1/60 (5.4); boundary check asserting `engine/` has zero Vue/Nuxt imports and no `Math.random`/wall-clock (5.1, 5.3).
    - _Requirements: 5.1, 5.3, 5.4, 5.6, 5.8_

- [x] 12. Checkpoint — Phase 3 engine core complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Phase 4 — Skill system and starter skills
  - [x] 13.1 Implement skill types and registry
    - Create `engine/skills/types.ts` (`SkillContext` with readable `source` on damage-driven hooks, `SkillDefinition` with only hooks `onTick`/`onHit`/`onHurt`/`onWallBounce`/`onDeath`, `SkillInstance`) and `engine/skills/registry.ts` (`SkillRegistry` rejecting duplicate/empty ids; `skillRegistry` singleton). Wire the engine to resolve ball-config skill ids against the registry, rejecting unknown ids with an error naming the id, and to emit exactly one `skillTriggered` event per triggered skill.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [ ]* 13.2 Write property test for skillTriggered emission
    - **Property 16: Each skill trigger emits exactly one skillTriggered event**
    - **Validates: Requirements 9.4**
  - [x] 13.3 Implement the five starter skills
    - Create `engine/skills/vampire.ts` (`onHit`: heal `healFraction` × damage dealt, clamped to `maxHp`), `spike.ts` (`onHurt`: on `contact` damage reflect `reflectAmount` to attacker via `applyDamage` with `isReflected`), `blaster.ts` (`onTick`: every `fireInterval` steps spawn one projectile credited to the ball), `splitter.ts` (`onDeath`: spawn `splitCount` balls at `radiusFactor` radius), `grower.ts` (`onWallBounce`: increase radius by `radiusGain` and speed by `speedGain`). Register all five.
    - _Requirements: 9.6, 9.7, 9.8, 9.9, 9.10_
  - [ ]* 13.4 Write property test for Vampire
    - **Property 17: Vampire heals a clamped fraction of damage dealt**
    - **Validates: Requirements 9.6**
  - [ ]* 13.5 Write property test for Spike
    - **Property 18: Spike reflects contact damage to the attacker**
    - **Validates: Requirements 9.7**
  - [ ]* 13.6 Write property test for Blaster
    - **Property 19: Blaster fires on interval**
    - **Validates: Requirements 9.8**
  - [ ]* 13.7 Write property test for Splitter
    - **Property 20: Splitter spawns reduced-radius balls on death**
    - **Validates: Requirements 9.9**
  - [ ]* 13.8 Write property test for Grower
    - **Property 21: Grower grows per wall bounce**
    - **Validates: Requirements 9.10**
  - [ ]* 13.9 Write unit tests for skill registry and ids
    - Five starter skills register under unique ids; registry rejects empty/duplicate ids; unknown-skill-id rejection message (9.1, 9.5).
    - _Requirements: 9.1, 9.5_

- [x] 14. Phase 5 — Weapon system and starter weapons
  - [x] 14.1 Implement weapon types and registry with validation
    - Create `engine/weapons/types.ts` (`WeaponMode` only `held`/`orbit`, `Hitbox`, `ProjectileSettings`, `WeaponDefinition` with required fields and bounds plus optional `projectile` and `cannotBeParried`) and `engine/weapons/registry.ts` (`WeaponRegistry.register` validating every required field and bound, rejecting and excluding invalid definitions with an error naming the offending field; `weaponRegistry` singleton).
    - _Requirements: 10.1, 10.2, 10.3_
  - [ ]* 14.2 Write property test for weapon-definition validation
    - **Property 22: Invalid weapon definitions are rejected at registration**
    - **Validates: Requirements 10.2**
  - [x] 14.3 Implement weapon motion, hits, clashes, and projectiles in the step
    - Wire the engine step: orbit weapons advance angle by `angularSpeed` × TIMESTEP and position to owner + unit(angle) × orbit radius; held weapons position to owner and orient toward target; weapon hitbox vs opposing ball with no active `hitCooldown` → `applyDamage` source `weapon` once then start pair cooldown; two overlapping weapon hitboxes → `Weapon_Clash` resolved to one of `bounce`/`parry`/`disarm` by weight with no direct damage and exactly one `weaponClash` event, where a `cannotBeParried` weapon never yields `parry`; weapons with projectile settings spawn a projectile on fire that applies `projectile` damage credited to the owner on overlap.
    - _Requirements: 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.12_
  - [ ]* 14.4 Write property test for weapon motion
    - **Property 23: Weapon motion matches its mode**
    - **Validates: Requirements 10.4, 10.5**
  - [ ]* 14.5 Write property test for weapon hit
    - **Property 24: Weapon hit applies weapon damage once and starts cooldown**
    - **Validates: Requirements 10.6**
  - [ ]* 14.6 Write property test for weapon clash
    - **Property 25: Weapon clash resolves to one weighted outcome with no damage**
    - **Validates: Requirements 10.8, 10.9, 10.12**
  - [ ]* 14.7 Write property test for projectile damage
    - **Property 26: Projectiles damage opposing balls credited to the owner**
    - **Validates: Requirements 10.10**
  - [x] 14.8 Implement the five starter weapons
    - Create `engine/weapons/sword.ts` (held baseline), `hammer.ts` (held, heaviest weight, `cannotBeParried: true`), `spear.ts` (held, greatest length), `orbiting-blade.ts` (orbit), `bow.ts` (held with `projectile` settings). Register all five.
    - _Requirements: 10.11_
  - [ ]* 14.9 Write unit tests for starter weapons
    - Five weapons register; Hammer heaviest and unparryable, Spear longest, Bow has projectile settings; mode is only `held`/`orbit` (10.1, 10.3, 10.11).
    - _Requirements: 10.1, 10.3, 10.11_

- [x] 15. Checkpoint — Phases 4–5 skills and weapons complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Phase 6 — Retro sprite system, Versus page, renderer, and lifecycle
  - [x] 16.0 Implement the retro sprite/asset system (hybrid: procedural + optional PNG)
    - Create `assets/sprites/manifest.ts`: a typed registry mapping every `spriteId` to its source. Each entry is either `{ kind: 'procedural'; draw(ctx, size) }` (pixel grid drawn in code) or `{ kind: 'image'; src: string }` (PNG under `public/sprites/`). Procedural is the default so the game runs with zero external files; an entry can later be swapped to an image with no logic change.
    - Create `composables/useSprites.ts` (client-only): preloads/caches sprite canvases at the base pixel grid (entities 32×32, spear 48×12, projectile 8×8, icons 16×16), renders them with `imageSmoothingEnabled = false` at integer scale, and exposes `drawSprite(ctx, spriteId, x, y, scale, angle?)`. Missing/failed images fall back to a visible placeholder sprite, never a crash.
    - Add a global retro look: register one bitmap pixel font (8px tall) and a 9-slice panel/button helper (tile 8×8) usable across pages.
    - Keep this layer entirely in the app/client; the engine stays sprite-agnostic.
    - _Requirements: 11.5, 11.6_
  - [x] 16.0b Add optional visual-reference ids to engine data (no logic change)
    - Add optional, logic-free fields so the renderer can map engine entities to sprites: `spriteId?: string`, `iconId?: string` and `pivot?: { x: number; y: number }` (sprite-pixel rotation point, see assets-plan.md Pivot table) on `WeaponDefinition`, and `iconId?: string` on `SkillDefinition`. These are pure identifiers consumed only by the app layer; the engine ignores them and determinism is unaffected. Set them on the five starter weapons (`sword`,`hammer`,`spear`,`orbiting-blade`,`bow`) and five starter skills.
    - _Requirements: 11.5_
  - [x] 16.1 Provide default balls, ball appearance model, and HP-bar clamp helper
    - Add at least two default balls so Versus runs without login or saved content. Give `BallConfig` an optional `appearance` field (data only, engine stays pure): `{ type: 'color'; value: string } | { type: 'pattern'; patternId: string } | { type: 'image'; src: string }`, defaulting to a solid color. The renderer draws a ball by clipping a circle (`ctx.arc` + `ctx.clip`) and filling it per `appearance` (solid color, pixel pattern, or user image) — no ball sprite asset is required. Add a pure `hpBarFraction(hp, maxHp)` clamped to `[0, 1]`.
    - _Requirements: 11.3, 11.7_
  - [ ]* 16.2 Write property test for HP-bar clamp
    - **Property 28: HP bar fraction is clamped**
    - **Validates: Requirements 11.7**
  - [x] 16.3 Implement the client-only duel composable and retro renderer
    - Create `composables/useVersusDuel.ts` (client-only): owns the rAF loop advancing the engine by whole steps scaled by simulation speed, draws the World to a 2D canvas context once per frame, updates `hp`/`winner`/`lastEvent` `shallowRef`s at most once per frame, never deep-binds entity state into Vue. `rematch()` re-runs the same seed+config; `dispose()` cancels rAF and drops listeners.
    - Render in retro pixel style via `useSprites` with `imageSmoothingEnabled = false` and integer scaling: draw a tiled arena floor + wall border, balls via the `appearance` circle-clip fill, weapons via their `spriteId` sprite rotated by the `WeaponEntity` angle around `WeaponDefinition.pivot` (default left-middle). Held weapons are anchored at the ball's surface (`owner.position + facing × owner.radius`), NOT at `WeaponEntity.position`, which the engine keeps at the hitbox center for collision; orbit weapons are anchored at `WeaponEntity.position`, projectiles as the 8×8 projectile sprite, and HP bars with a 9-slice frame + fill. Draw the pixel font for labels.
    - Add a `showHitboxes` debug overlay (off by default): draw each weapon's logical hitbox outline (`segment`/`circle` from `WeaponDefinition.hitbox`) over the sprite so sprite-vs-hitbox alignment can be verified. IMPORTANT: hitboxes remain geometric data in the engine and are the single source of collision truth; sprites are visual only and are tuned to cover their hitbox. The renderer never derives collision from sprite pixels.
    - _Requirements: 11.5, 11.6, 11.8, 11.10, 11.11_
  - [x] 16.4 Wire the versus page UI
    - Replace the `/versus` placeholder body: select exactly two balls from Library, Roulette results, or default balls; block start with an error when not exactly two; configure the Arena into a `Duel_Config`; render one HP bar per ball (`hpBarFraction`); show a winner screen within 100 ms of `matchEnded`; rematch control; dispose the engine on unmount.
    - _Requirements: 11.1, 11.2, 11.4, 11.9_
  - [ ]* 16.5 Write unit/component tests for versus page
    - Exactly-two-ball selection and error on other counts (11.1, 11.2); at least two default balls (11.3); arena configures into a `Duel_Config` (11.4); winner screen on `matchEnded` (11.9); unmount disposes engine, cancels rAF, removes listeners (11.11).
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.9, 11.11_
  - [x] 16.6 Rework weapon behavior: all-orbit motion, facing-triggered projectiles, physical clash
    - Design revision agreed during Phase 6 playtest. Keep both `WeaponMode` values in the type for extensibility, but make every starter weapon `orbit`.
    - Motion: all weapons orbit with a STATIC `angularSpeed` from the definition — remove the `held` orient-toward-target path from `moveWeapons`. (Future: a skill may modify a weapon's spin speed; not now.)
    - Projectile firing (bow and any weapon with `projectile`): spawn a projectile only when the weapon is currently facing an opponent — the orbit angle points toward the nearest living opponent within a ±15° threshold — AND the fire cooldown is ready. Range (near or far) does not matter. Firing stays deterministic (derived from positions/angles + fixed cooldown, no wall-clock).
    - Clash gets a physical effect: on any weapon-vs-weapon overlap, apply knockback to BOTH owner balls along their center line (reuse `applyKnockback`), resolve the outcome by weight (`bounce`/`parry`/`disarm`, Hammer never `parry`), emit exactly one `weaponClash` event, and apply NO damage and NO change to weapon spin (angularSpeed stays static).
    - Bow deals no contact/melee damage (its `damage` is 0, so it is skipped by `applyWeaponHits`) but still participates in clash/parry/knockback.
    - Update the five weapon defs to `mode: 'orbit'`; update the renderer anchor accordingly (orbit weapons at `WeaponEntity.position`). Re-verify determinism (two identical runs byte-identical) and re-test in the browser.
    - _Requirements: 10.4, 10.6, 10.7, 10.8, 10.9, 10.10, 10.12_

- [ ] 17. Phase 7 — Roulette and library store
  - [ ] 17.1 Implement the seeded roulette draw
    - Create `engine/roulette.ts`: `spinRoulette(seed, skills, weapons)` draws exactly one skill id and one weapon id using a seeded `Rng`, selecting only from current registry entries; same seed + same registry contents → identical result; registries unchanged by the spin; throws `EmptyRegistryError` when either registry is empty.
    - _Requirements: 12.1, 12.3, 12.4, 12.5_
  - [ ]* 17.2 Write property test for roulette reproducibility
    - **Property 27: Roulette draws reproducibly from current registries**
    - **Validates: Requirements 12.1, 12.3, 12.5**
  - [ ] 17.3 Implement the library store with persistence, Duel_Config save, and export/import
    - Create `stores/library.ts`: holds balls/skills/weapons/duels each with a unique id; persists to localStorage within 1 s of change; retains in-memory state and surfaces an error on write failure; loads to empty state on absent/corrupt data without a blocking error. Save a Duel as `{ engineVersion, seed, ballConfigs, arenaConfig }` with `engineVersion` set at save time. Export produces one JSON document with full Library + Settings contents; import validates the shape and replaces both stores, or rejects invalid JSON/shape leaving both unchanged. Shapes JSON-serializable.
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_
  - [ ]* 17.4 Write property test for export/import JSON round-trip
    - **Property 29: Library and settings survive export/import and JSON round-trips**
    - **Validates: Requirements 13.6, 13.7, 13.10**
  - [ ] 17.5 Wire the roulette page with a pixel reel UI
    - Replace the `/roulette` placeholder body: spin with a provided integer seed, or generate and record a seed within 2 s when none provided; show an error identifying the empty registry on empty-registry spin; save a result's ball config including the seed to the Library_Store without login; retain the unsaved result and show an error on save failure.
    - Present the roulette in retro pixel style: a reel/slot strip tiled from a pixel background, skill/weapon shown via their 16×16 `iconId` sprites, a pixel spin button with idle/pressed frames, and a landing highlight/glow overlay. The reel animation is cosmetic only — the actual draw stays the deterministic seeded `spinRoulette` result (visuals must land on that result). Honor reduced-motion by skipping the spin animation and showing the result immediately.
    - _Requirements: 12.2, 12.6, 12.7, 12.8_
  - [ ]* 17.6 Write unit tests for roulette and library
    - No-seed spin generates and records a seed (12.2); empty-registry rejection message (12.4); save stores ball config with the seed (12.7); save-failure handling (12.8); library holds balls/skills/weapons with ids (13.1); invalid import rejected leaving state unchanged (13.8); corrupt/absent load → empty (13.5); saved Duel shape with current `engineVersion` (13.9).
    - _Requirements: 12.2, 12.4, 12.7, 12.8, 13.1, 13.5, 13.8, 13.9_

- [ ] 18. Checkpoint — Phases 6–7 versus, roulette, library complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Phase 8 — Recording and audio
  - [ ] 19.1 Implement mime selection helper
    - Create `composables/useRecorder.ts` with `MIME_FALLBACKS` (WebM-first ordered list) and `pickMimeType()` returning the first candidate `MediaRecorder.isTypeSupported` accepts, or null when none match.
    - _Requirements: 14.2, 14.3_
  - [ ]* 19.2 Write property test for mime selection
    - **Property 34: Recording mime selection picks the first supported candidate**
    - **Validates: Requirements 14.2**
  - [ ] 19.3 Implement the recorder and Web Audio layer
    - In `composables/useRecorder.ts` (client-only): capture the canvas via `canvas.captureStream(60)`, encode with `MediaRecorder` using the picked mime, abort with an "unsupported" error and no partial save when none match, render at the configured resolution independent of display size. Create `composables/useAudio.ts` (client-only): produce hit/skill/clash/win sounds via Web Audio, silent when the sound setting is disabled, and mix the audio track into the recorded stream so the file has video + audio. Auto-record starts the duel, records, stops within 2 s after the winner, and saves.
    - _Requirements: 14.1, 14.4, 14.5, 14.6, 14.11, 15.6, 15.8_
  - [ ] 19.4 Implement recordings store and IndexedDB blob storage
    - Create `stores/recordings.ts` (metadata only) and an IndexedDB helper keyed by `RecordingMeta.id`: on completion store the blob in IndexedDB and metadata in the store; on IndexedDB failure surface an error and create no metadata entry.
    - _Requirements: 14.7, 14.8_
  - [ ] 19.5 Wire the recordings page
    - Replace the `/recordings` placeholder body: list all saved recordings; on selection play back the recording and allow download.
    - _Requirements: 14.9, 14.10_
  - [ ]* 19.6 Write smoke tests for recording path
    - 1–2 browser-capable examples of capture/encode/mix/auto-record/IndexedDB and recordings list/playback/download (14.1, 14.4–14.11).
    - _Requirements: 14.1, 14.4, 14.5, 14.6, 14.7, 14.9, 14.10, 14.11_

- [ ] 20. Phase 9 — Settings, accessibility, and polish
  - [ ] 20.1 Implement the settings store with sanitizing load
    - Create `stores/settings.ts`: resolution (width/height integers 1–7680), aspect ratio (default `9:16`), sound (default enabled), simulation speed (0.1–10.0, default 1.0), default resolution 1080×1920; persist within 1 s of change; on load replace absent/out-of-bound values with defaults without a blocking error.
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  - [ ]* 20.2 Write property test for settings sanitization
    - **Property 30: Settings load sanitizes every field to its bounds**
    - **Validates: Requirements 15.5**
  - [ ] 20.3 Implement simulation-speed step-count scaling
    - Add a pure `stepsForElapsed(realSeconds, speed)` = whole steps `realSeconds × 60 × speed`, keeping each step's timestep exactly 1/60 s; use it to drive the versus rAF loop.
    - _Requirements: 15.7_
  - [ ]* 20.4 Write property test for simulation-speed scaling
    - **Property 31: Simulation speed scales step count, not the timestep**
    - **Validates: Requirements 15.7**
  - [ ] 20.5 Implement reduced-motion, keyboard a11y, and per-source pixel hit feedback
    - Honor `prefers-reduced-motion: reduce` by zeroing decorative/transition UI animation (0 ms) while keeping the simulation's fixed-timestep rate and outcome unchanged. Ensure menu controls are fully keyboard operable (Tab/Shift+Tab, Enter/Space) with exactly one visible focus indicator at a time (reuse the Phase 1 menu). On each registered hit present a 50–500 ms hit-flash whose appearance differs per `contact`/`weapon`/`projectile` source so the source is distinguishable by sight.
    - Render the hit-flash as a 32×32 pixel sprite with three visually distinct variants (one per `contact`/`weapon`/`projectile` source) drawn at the hit location via `useSprites`, consistent with the retro style. Distinction must hold by shape/pattern, not color alone, so it survives reduced-motion and color-blind viewing.
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_
  - [ ] 20.6 Wire the settings page
    - Replace the `/settings` placeholder body with controls bound to the settings store for resolution, aspect ratio, sound, and simulation speed.
    - _Requirements: 15.1, 15.6, 15.8_
  - [ ]* 20.7 Write unit tests for settings and accessibility
    - Settings defaults (15.1, 15.2); sound-disabled silence (15.6); reduced-motion zeroes UI animation while simulation outcome is unchanged (16.1, 16.2); single visible focus indicator and keyboard operability (16.3, 16.4); hit-flash duration and per-source distinction (16.5, 16.6).
    - _Requirements: 15.1, 15.2, 15.6, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

- [ ] 21. Phase 9 — README architecture, extension, determinism, and roles sections
  - [ ] 21.1 Write remaining README sections
    - Add the architecture section (each major component, responsibilities, data flow); the extension section with separate step-by-step procedures for adding a Skill, a Weapon, and a new Damage_Source (files to create/modify and steps); the determinism section (how determinism is achieved, how `engineVersion` is defined/incremented/used); and the roles section (how roles evolve, and that the default role must change to `viewer` before public deployment).
    - _Requirements: 17.1, 17.3, 17.4, 17.5_

- [ ] 22. Final checkpoint — all phases complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Engine tasks keep `engine/` framework-free, deterministic, and pure TypeScript — zero Vue/Nuxt imports, no `Math.random`, no wall-clock.
- Property tests use `fast-check` with a minimum of 100 iterations each; engine tests run framework-free (Vitest `node` environment, no DOM).
- Each property sub-task references exactly one of the 34 correctness properties and the requirement clauses it validates.
- Checkpoints ensure incremental validation at phase boundaries.
- Database, recording I/O, and UI/accessibility behavior use example/integration/smoke tests rather than property iterations, per the design's Testing Strategy.

### Retro / pixel-art direction (project-wide)

- The whole app uses a retro, pixel-art look. All canvas rendering uses `imageSmoothingEnabled = false` and integer scaling to keep pixels crisp.
- Base pixel grids: entities 32×32 (spear 48×12), projectile 8×8, UI/skill/weapon icons 16×16, bitmap font 8px tall, 9-slice panels/buttons tiled at 8×8.
- Sprites are supplied via a hybrid system: procedural pixel grids by default (zero external files) with the option to swap any entry to a PNG under `public/sprites/` with no logic change.
- Balls are not sprites: a ball is a circle-clipped fill driven by `BallConfig.appearance` (solid color, pixel pattern, or user image), so ball color/skin is fully customizable.
- Hitboxes vs sprites are separate layers. Hitboxes are geometric data in the engine (`segment`/`circle`) and are the single source of collision truth; sprites are visual only and are tuned to cover their hitbox. The engine never reads sprite pixels, preserving determinism (Req 5.1, 5.3, 5.6). A `showHitboxes` debug overlay verifies alignment.
- Engine data gains only logic-free visual-reference fields (`spriteId`/`iconId`/`pivot`); they do not affect simulation or determinism.
- The full asset catalog, sizes, and generation prompts live in `.kiro/specs/ball-battle-simulator/assets-plan.md`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.3", "3.1", "3.3", "6.1"] },
    { "id": 2, "tasks": ["2.2", "2.4", "3.2", "3.4", "6.2", "7.1"] },
    { "id": 3, "tasks": ["3.5", "3.6", "8.1"] },
    { "id": 4, "tasks": ["3.7", "3.8", "4.1", "8.2", "9.1", "9.2"] },
    { "id": 5, "tasks": ["8.3", "8.4", "8.5", "8.6", "8.7", "9.3", "9.4", "10.1"] },
    { "id": 6, "tasks": ["10.2", "10.3", "10.4", "11.1"] },
    { "id": 7, "tasks": ["11.2", "11.3", "11.4", "11.5", "11.6", "11.7", "13.1"] },
    { "id": 8, "tasks": ["13.2", "13.3"] },
    { "id": 9, "tasks": ["13.4", "13.5", "13.6", "13.7", "13.8", "13.9", "14.1"] },
    { "id": 10, "tasks": ["14.2", "14.3", "14.8"] },
    { "id": 11, "tasks": ["14.4", "14.5", "14.6", "14.7", "14.9", "17.1"] },
    { "id": 12, "tasks": ["16.1", "17.2", "17.3"] },
    { "id": 13, "tasks": ["16.2", "16.3", "17.4", "17.5", "20.1"] },
    { "id": 14, "tasks": ["16.4", "17.6", "19.1", "20.2", "20.3"] },
    { "id": 15, "tasks": ["16.5", "19.2", "19.3", "20.4", "20.5", "20.6"] },
    { "id": 16, "tasks": ["19.4", "20.7", "21.1"] },
    { "id": 17, "tasks": ["19.5"] },
    { "id": 18, "tasks": ["19.6"] }
  ]
}
```
