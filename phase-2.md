# Task: Finish the Ball Battle Simulator (Phases 2 to 9)

Phase 1 (scaffold) is already done. First inspect the repo (folder structure, config, existing placeholder pages, any README/CLAUDE.md) and adapt to what exists instead of redoing it. Then complete ALL remaining phases below in order, without waiting for my confirmation between phases.

## Product
A web app inspired by the viral "ball vs ball" simulation videos: balls fight in an arena, each with its own skills and optional weapons. A roulette draws skills and weapons. A versus mode runs the duel. Duels can be recorded as video. Users can have accounts. The codebase must stay easy to extend (new skills, weapons, attack types).

## Tech stack (already scaffolded, keep it)
Nuxt 3 + TypeScript, Tailwind CSS, Pinia (+ persistence plugin), `nuxt-auth-utils`, PostgreSQL + Drizzle ORM, HTML Canvas 2D (client-only), Vitest. No physics library; write collision by hand.

## Architecture rules (mandatory)
1. **Engine is framework-free**: `engine/` is pure TypeScript with no Vue/Nuxt imports, unit-tested with Vitest.
2. **Deterministic**: seeded RNG (mulberry32), fixed timestep (1/60 s), stable entity iteration order. No `Math.random()` or wall-clock time inside the engine. Add a test that runs the same seed + setup twice and asserts identical results.
3. **No per-frame state in Vue reactivity.** Expose to Vue only HP, winner, and events via callbacks or a throttled `shallowRef`.
4. **Engine lifecycle per page**: create on mount, dispose on unmount (cancel `requestAnimationFrame`, remove listeners).
5. **Single damage gateway**: all HP changes go through `applyDamage({ source, attackerId, targetId, amount, flags })`. Nothing else subtracts HP.
6. **Damage sources are an extensible union**: start with `contact`, `weapon`, `projectile`; keep room for `area`, `dot`, `environment`, `beam`, `summon`, `reflect`. `attackerId` may be empty. Summon damage is credited to the owner.
7. **Reflected damage cannot be reflected again** (`isReflected` flag).
8. **Status effect system from day one**: per-ball list with duration and tick interval, wired into the step even if no skill uses it yet.
9. **World holds generic entities** (balls, projectiles, weapons, later mines, minions, areas) with a stable update order.
10. **Data-driven definitions**: one file per skill in `engine/skills/`, one definition per weapon in `engine/weapons/`, central registries. Roulette only picks and combines definitions.
11. **Hit cooldown per attacker-target pair** so one swing does not damage every frame.
12. **Fixed step order**: move balls and weapons, detect collisions, resolve weapon clashes, apply damage, apply knockback, run status effects, check win condition.
13. **Engine versioning**: store `engineVersion` with every saved duel.
14. **Authorization is centralized**: server routes use `requireUser(event)`; permission checks go through `can(user, permission)` in `server/utils/permissions.ts`. Never rely on hiding UI as security.

## Combat design
- Damage sources: **contact** (ball body, each ball has `contactDamage`, can be 0), **weapon** (weapon hitbox), **projectile** (credited to owner). Weapon clash (weapon vs weapon) is an interaction, not damage: outcome depends on weapon weight (bounce, parry, disarm). Every hit applies small knockback.
- Weapons: zero or more per ball. Two modes: **held** (attached to ball, swings or points toward target) and **orbit** (`angle += angularSpeed * dt`, position = ball + direction * orbitRadius). Hitbox shapes: segment/capsule or small circle/box at the tip. Fields: `id`, `name`, `mode`, `length`, `damage`, `angularSpeed`, `weight`, `hitCooldown`, `hitbox`, optional projectile settings.
- Skill hooks: `onTick`, `onHit`, `onHurt`, `onWallBounce`, `onDeath`. Skills can read the damage `source`.
- Starter skills: Vampire (heal on hit), Spike (reflect contact damage), Blaster (periodic projectile), Splitter (split on death), Grower (bigger and faster per bounce).
- Starter weapons: Sword (held), Hammer (held, heavy, cannot be parried), Spear (held, long), Orbiting blade (orbit), Bow (ranged).
- Engine events: `damage` (with source), `skillTriggered`, `weaponClash`, `ballDied`, `matchEnded`.
- Do NOT build now: area/AoE, DoT, hazards, beams, summons, traps. Just do not block them.

## Accounts and roles
- Register, login, logout, session persistence, protected route middleware, basic account menu.
- `users`: `id`, `email` (unique), `password_hash` (use the hashing from `nuxt-auth-utils`), `role` (`superuser` | `viewer`), `created_at`.
- **Every new account is `superuser` for now**, and `can()` returns true for `superuser`. Do NOT build per-role rules, admin pages, or role-management UI.
- Role is stored in the session. Add `created_by` to every content table.
- Leave a clearly marked TODO in `permissions.ts` and the register handler: before any public deployment, default role must become `viewer` and a real permission map must exist.

## Pages (non-linear, menu-based; each openable directly)
`/` home menu, `/login`, `/register`, `/roulette`, `/versus`, `/library`, `/recordings`, `/settings`.
- Roulette: spin a wheel to draw skills and weapons for a ball, seeded and reproducible.
- Versus: pick two balls (library, roulette results, or defaults), configure the arena, run the duel, show HP bars and a winner screen, rematch button.
- Provide default balls so Versus works out of the box. Roulette and Versus work without login (local storage).
- Library: saved balls, skills, weapons. Recordings: list, playback, download. Settings: resolution, aspect ratio (default 9:16, 1080x1920), sound, simulation speed.

## State and persistence
- Pinia stores: `library`, `settings`, `recordings` metadata.
- localStorage for library and settings, IndexedDB for recording blobs.
- A duel is storable as `{ engineVersion, seed, ballConfigs, arenaConfig }`.
- Export / Import JSON for library and settings.
- Server-side sync of library/recordings for logged-in users is out of scope; keep data shapes sync-ready.

## Recording
`canvas.captureStream(60)` + `MediaRecorder` with `MediaRecorder.isTypeSupported()` fallback (WebM first). Render resolution independent from display size. Web Audio sound layer (hit, skill, clash, win) mixed into the recorded stream. "Auto record" mode: one button runs the duel, records, stops shortly after the winner appears, and saves it.

## UX
Mobile-first and portrait-friendly, works on desktop. Clear HP bars, hit flash, readable skill labels, feedback that differs per damage source. Respect `prefers-reduced-motion` for UI animation (not the simulation). Keyboard-accessible menus, visible focus states.

## Phases to complete (in order)
2. Auth: Drizzle + PostgreSQL, migrations, register/login/logout, session, middleware, `requireUser` and `can()` stubs, `.env.example`, a `docker-compose.yml` for local Postgres, README setup section
3. Engine core: RNG, fixed-timestep loop, entity-based world, ball/arena physics, `applyDamage`, status effect system, hit cooldowns, determinism tests
4. Skill system + 5 starter skills + tests
5. Weapon system: held and orbit modes, hitboxes, weapon-vs-body and weapon-vs-weapon resolution, starter weapons + tests
6. Versus page: canvas renderer, HP bars, winner screen, rematch
7. Roulette page + library store + local persistence + Export/Import JSON
8. Recording + audio + recordings page
9. Settings, polish, README

## How to work
- Work through the phases without waiting for confirmation. After each phase: run lint, type-check, and tests, fix failures, then make a commit with a clear message.
- Maintain a `PROGRESS.md` at the repo root: phases done, what was built, decisions made, known issues, and what remains. Update it after every phase so work can be resumed in a new session.
- Stop and ask me ONLY if: tests or the build cannot be fixed after reasonable attempts, a required secret or external account is needed, or a decision would change the architecture rules above. For anything smaller, make a sensible choice, record it in `PROGRESS.md`, and continue.
- Do not refactor or rewrite finished phases without a reason; if you must change an earlier decision, note why in `PROGRESS.md`.
- Strict TypeScript, no `any` unless justified. Never commit secrets; use environment variables.
- Do not deploy anything.

## Definition of done
- All pages work and are reachable from the menu
- A full flow works end to end: roulette draws skills/weapons, versus runs a deterministic duel with contact, weapon, and projectile damage, and the duel can be recorded and played back
- Login works, and the app is clearly marked as not ready for public deployment until roles are implemented
- Tests pass, including the determinism test
- README covers architecture, local setup, how to add a skill, a weapon, and a new damage source, how determinism and `engineVersion` work, and how roles are intended to evolve

When all phases are done, give me a short summary: what was built, how to run it, known limitations, and recommended next steps.