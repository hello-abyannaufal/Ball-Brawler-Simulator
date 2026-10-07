# Project: Ball Battle Simulator

Build a web app inspired by the viral "ball vs ball" simulation videos: balls fight inside an arena, and each ball has its own skills and (optionally) weapons. A roulette feature generates the skills and weapons. The app must be easy to extend long-term (new skills, weapons, and attack types), support user accounts, and produce shareable video clips.

## Tech stack
- Nuxt 3 (Vue 3, Composition API, `<script setup>`) + TypeScript
- Tailwind CSS, Pinia (+ persistence plugin)
- Auth: `nuxt-auth-utils` (session cookies), email + password
- Database: PostgreSQL with Drizzle ORM, migrations committed to the repo
- Rendering: HTML Canvas 2D (no game framework); canvas components run client-only (`<ClientOnly>` / `onMounted`)
- No physics library for the MVP; write circle-circle, circle-segment, and circle-wall collision by hand

## Architecture rules (important)
1. **Engine is framework-free.** Put it in `engine/` as pure TypeScript with zero Vue/Nuxt imports. Unit-testable with Vitest.
2. **Deterministic simulation.** Seeded RNG (mulberry32) and fixed timestep (1/60 s). Same seed + same setup must produce the exact same duel. Never use `Math.random()` or wall-clock time inside the engine. Iterate entities in a stable order.
3. **No per-frame state in Vue reactivity.** The engine owns positions and velocities. Expose to Vue only what the UI needs (HP, winner, events) via callbacks or a throttled `shallowRef`.
4. **Engine lifecycle per page.** Versus page creates an engine instance on mount and disposes it on unmount.
5. **Single damage gateway.** ALL HP changes go through one function, e.g. `applyDamage({ source, attackerId, targetId, amount, flags })`. No other code may subtract HP directly. This function emits a damage event and runs the skill hooks.
6. **Damage sources are an extensible union.** Start with `contact`, `weapon`, `projectile`. Define the type so that `area`, `dot`, `environment`, `beam`, `summon`, `reflect` can be added later without touching existing code. `attackerId` may be empty (e.g. environment). Damage caused by a summon is credited to its owner.
7. **Reflected damage cannot be reflected again.** Mark reflected damage with a flag (`isReflected`) to prevent infinite loops between two reflecting balls.
8. **Status effect system from day one.** Each ball has a list of status effects with duration and tick interval. It may be unused at first, but poison, burn, slow, etc. must be able to plug into it later.
9. **World holds generic entities, not only balls.** Balls, projectiles, weapons, and (later) mines, minions, and areas are all entities managed by the world with a stable update order, so new entity types can be added without restructuring the world.
10. **Data-driven definitions.** Skills and weapons are registered definitions (typed objects or JSON), not if/else chains. One file per skill in `engine/skills/`, one definition per weapon in `engine/weapons/`, plus central registries. Roulette only picks and combines definitions.
11. **Hit cooldown per attacker-target pair.** A single sword swing must not apply damage every frame while overlapping. Track which targets were hit and when (or use short invulnerability frames).
12. **Fixed resolution order each step:** move balls and weapons, detect collisions, resolve weapon clashes first, then apply damage, then apply knockback, then run status effects, then check win condition.
13. **Engine versioning.** Store `engineVersion` with every saved duel (`seed + config`). Replays of old duels must either run with a matching version or show a clear notice that results may differ.
14. **Determinism tests.** Add a test that runs the same seed and setup twice and asserts identical results. Run it whenever the engine changes.
15. **Authorization is centralized.** All server routes needing a logged-in user call `requireUser(event)`. Permission-sensitive actions go through `can(user, permission)` in `server/utils/permissions.ts`. Never scatter role checks, and never rely on hiding UI as security.

## Combat design
Damage sources (initial scope):
- **Contact**: ball body touches enemy body. Each ball has a `contactDamage` value (can be 0 for balls that only fight with weapons).
- **Weapon**: weapon hitbox touches enemy body.
- **Projectile**: a projectile touches enemy body; projectile damage is credited to its owner.
- **Weapon clash** is not a damage source but an interaction (weapon vs weapon): outcome depends on weapon weight (bounce, parry, or disarm).
- Every hit applies a small knockback to the target.

Weapons:
- A ball can have zero or more weapons.
- Two movement modes: **held** (attached to the ball, swings or points toward the target) and **orbit** (angle advances each step: `angle += angularSpeed * dt`, position = ball position + direction * orbitRadius).
- Hitbox shapes: segment or capsule (sword, spear), small circle or box at the tip (hammer, shield).
- Weapon data fields: `id`, `name`, `mode`, `length`, `damage`, `angularSpeed`, `weight`, `hitCooldown`, `hitbox`, optional projectile settings for ranged weapons.

Skill interface: `id`, `name`, `description`, `rarity`; hooks `onTick`, `onHit`, `onHurt`, `onWallBounce`, `onDeath`. Skills can read the damage `source` to react differently (for example, an armor skill that only reduces projectile damage).

Starter skills: Vampire (heal on hit), Spike (reflect contact damage), Blaster (periodic projectile), Splitter (splits on death), Grower (bigger and faster per bounce).
Starter weapons: Sword (held), Hammer (held, heavy, cannot be parried), Spear (held, long), Orbiting blade (orbit), Bow (ranged, projectile).

Engine events for UI and audio: `damage` (with source), `skillTriggered`, `weaponClash`, `ballDied`, `matchEnded`.

Later (do NOT build now, but do not block): area/AoE, damage over time, arena hazards, beams, summons, traps/mines.

## Accounts and roles (current scope: login only)
- Features: register, login, logout, session persistence, protected route middleware, basic account menu.
- `users` table: `id`, `email` (unique), `password_hash` (use the hashing provided by `nuxt-auth-utils`), `role`, `created_at`.
- `role` is a text/enum column with the values `superuser` and `viewer`. **For now every new account is created as `superuser`**, and `can()` returns true for `superuser`. Do NOT build per-role permission rules, admin pages, or role-management UI yet.
- Keep the role in the session so server and client can read it.
- Add `created_by` (user id) to every content table created later (balls, skills, weapons, duels, recordings).
- Leave a clearly marked TODO in `permissions.ts` and in the register handler: before any public deployment the default role must change to `viewer` and a real permission map must be implemented.

## Pages and navigation (non-linear, menu-based)
- `/` Home menu
- `/login`, `/register`
- `/roulette` Spin a wheel to draw skills and weapons for a ball (seeded RNG, reproducible)
- `/versus` Pick two balls (library, roulette results, or defaults), configure the arena, run the duel, winner screen, rematch
- `/library` Saved balls, skills, and weapons
- `/recordings` Saved recordings with playback and download
- `/settings` Resolution, aspect ratio (default 9:16, 1080x1920), sound, simulation speed

Every page must be openable directly. Provide default balls so Versus works out of the box. Roulette and Versus remain usable without logging in (local storage).

## State and persistence
- Pinia stores: `library`, `settings`, `recordings` metadata
- For now: localStorage for library and settings, IndexedDB for recording blobs
- A duel is storable as `{ engineVersion, seed, ballConfigs, arenaConfig }` for exact replay
- Export / Import JSON for the library and settings
- Server-side sync for logged-in users is a LATER phase; design data shapes so sync can be added without changing the engine

## Recording
- `canvas.captureStream(60)` + `MediaRecorder`; check `MediaRecorder.isTypeSupported()` and pick a supported mime type (WebM first)
- Render resolution independent from on-screen size
- Web Audio API sound layer (hit, skill, clash, win) mixed into the recorded stream
- "Auto record" mode: one button runs the duel, records it, stops shortly after a winner appears, and saves it

## Visual and UX
- Mobile-first, portrait-friendly, works on desktop
- Clear HP bars, hit-flash effect, readable skill labels; visual/audio feedback differs per damage source
- Respect `prefers-reduced-motion` for UI animations (not for the simulation)
- Keyboard-accessible menus and visible focus states

## Working method
Work in phases. Stop after each phase so I can review; do not start the next until I confirm.
1. Scaffold: Nuxt 3 + TS + Tailwind + Pinia, folder structure, routes with placeholder pages
2. Auth: Drizzle + PostgreSQL, `users` table and migration, register/login/logout, session, route middleware, `requireUser` and `can()` stubs, `.env.example`, README section on local setup
3. Engine core: seeded RNG, fixed-timestep loop, entity-based world, ball/arena physics, `applyDamage` gateway, status effect system (empty but wired), hit cooldowns, determinism tests
4. Skill system + 5 starter skills + tests
5. Weapon system: held and orbit modes, hitboxes, weapon-vs-body and weapon-vs-weapon resolution, starter weapons + tests
6. Versus page: canvas renderer, HP bars, winner screen, rematch
7. Roulette page + library store + local persistence + Export/Import JSON
8. Recording + audio + recordings page
9. Settings, polish, README

## Quality bar
- Strict TypeScript, no `any` unless justified
- Run lint and tests before finishing each phase
- Commit per phase with clear messages
- Never commit secrets; read them from environment variables
- README explains the architecture, how to add a skill, a weapon, and a new damage source, how determinism and `engineVersion` work, and how roles are intended to evolve

Start with Phase 1 only, then summarize what you created and wait for my confirmation.
