# Requirements Document

## Introduction

This document covers Phases 2 through 9 of the Ball Battle Simulator, a web app inspired by viral "ball vs ball" simulation videos. Balls fight in an arena, each with skills and optional weapons. A seeded roulette draws skills and weapons for a ball. A versus mode runs a deterministic duel between two balls. Duels can be recorded as video with sound. Users can register accounts.

Phase 1 (scaffold) is complete and must not be redone: a Nuxt 3 + TypeScript app with Tailwind, Pinia (+ `pinia-plugin-persistedstate`), the architecture-compliant folder structure (`engine/`, `engine/skills/`, `engine/weapons/`, `server/utils/`, `pages/`, `stores/`), eight routable placeholder pages (`/`, `/login`, `/register`, `/roulette`, `/versus`, `/library`, `/recordings`, `/settings`), a keyboard-accessible navigation menu, and a mobile-first portrait layout (default 9:16). This spec builds feature behavior on top of that scaffold and replaces the placeholder page bodies with working features.

The phases covered here are:

- **Phase 2 — Auth**: Drizzle + PostgreSQL, migrations, register/login/logout, session, route middleware, centralized `requireUser`/`can`, `.env.example`, `docker-compose.yml`, README setup.
- **Phase 3 — Engine core**: seeded RNG, fixed-timestep loop, entity-based world, ball/arena physics, single `applyDamage` gateway, status-effect system, hit cooldowns, determinism tests.
- **Phase 4 — Skill system**: skill hooks, data-driven registry, five starter skills, tests.
- **Phase 5 — Weapon system**: held and orbit modes, hitboxes, weapon-vs-body and weapon-vs-weapon resolution, five starter weapons, tests.
- **Phase 6 — Versus page**: canvas renderer, HP bars, winner screen, rematch.
- **Phase 7 — Roulette page + library store**: seeded roulette, local persistence, Export/Import JSON.
- **Phase 8 — Recording**: canvas capture, audio, recordings page (list, playback, download).
- **Phase 9 — Settings and polish**: settings behavior, README, final polish.

The non-negotiable architecture rules from the product brief govern every phase: the engine is framework-free and deterministic, all HP changes flow through a single `applyDamage` gateway, damage sources are an extensible union, definitions are data-driven, authorization is centralized, and `engineVersion` is stored with every saved duel.

## Glossary

- **Engine**: The framework-free, pure-TypeScript simulation code under `engine/`. Contains zero Vue and zero Nuxt imports at any depth.
- **RNG**: The seeded pseudo-random number generator (mulberry32) used by the Engine. The sole source of randomness inside the Engine.
- **World**: The Engine container holding all generic Entities (balls, projectiles, weapons, and later mines, minions, areas) with a stable iteration order.
- **Entity**: A generic simulated object in the World (a ball, projectile, or weapon).
- **Ball**: An Entity that fights in the arena; has position, velocity, radius, HP, `contactDamage`, a list of skills, zero or more weapons, and a list of active status effects.
- **Arena**: The bounded simulation space (walls) with configurable dimensions in which balls move and collide.
- **Timestep**: The fixed simulation increment of 1/60 second used by the Engine for every step.
- **Step**: One fixed-timestep advancement of the World that executes the fixed step order.
- **applyDamage**: The single Engine function through which all HP reductions occur, taking `{ source, attackerId, targetId, amount, flags }`.
- **Damage_Source**: A tagged member of the extensible damage-source union. Phases 3-5 implement `contact`, `weapon`, and `projectile`; the union reserves room for `area`, `dot`, `environment`, `beam`, `summon`, and `reflect`.
- **Status_Effect**: A time-bound modifier attached to a Ball, with a duration and a tick interval, processed every Step.
- **Hit_Cooldown**: A per-attacker-target-pair timer that prevents a single damage interaction from applying damage on consecutive Steps.
- **Skill**: A data-driven definition in `engine/skills/` with lifecycle hooks (`onTick`, `onHit`, `onHurt`, `onWallBounce`, `onDeath`) that can read the triggering Damage_Source.
- **Skill_Registry**: The central registry mapping skill ids to Skill definitions.
- **Weapon**: A data-driven definition in `engine/weapons/` with a mode (`held` or `orbit`), a hitbox, and combat fields.
- **Weapon_Registry**: The central registry mapping weapon ids to Weapon definitions.
- **Weapon_Clash**: An interaction between two Weapon hitboxes resolved by weapon weight (bounce, parry, or disarm), producing no direct damage.
- **Knockback**: A small velocity impulse applied to a Ball on every hit.
- **Engine_Event**: A structured event emitted by the Engine (`damage`, `skillTriggered`, `weaponClash`, `ballDied`, `matchEnded`) consumed by the UI.
- **engineVersion**: A version identifier for the Engine, stored with every saved duel so results can be interpreted against the Engine that produced them.
- **Duel_Config**: The storable description of a duel: `{ engineVersion, seed, ballConfigs, arenaConfig }`.
- **Roulette**: The feature that draws skills and weapons for a ball from the registries using the seeded RNG, producing reproducible results from a seed.
- **Versus_Page**: The page at `/versus` that configures and runs a duel between two balls and renders it to canvas.
- **Renderer**: The client-only canvas drawing code that reads Engine state and draws each frame to an HTML Canvas 2D context.
- **Library_Store**: The Pinia store holding saved balls, skills, and weapons, persisted to localStorage.
- **Settings_Store**: The Pinia store holding user settings (resolution, aspect ratio, sound, simulation speed), persisted to localStorage.
- **Recordings_Store**: The Pinia store holding recording metadata, with recording blobs persisted to IndexedDB.
- **Recorder**: The client-only recording subsystem using `canvas.captureStream` and `MediaRecorder`.
- **Audio_Layer**: The client-only Web Audio subsystem producing sounds (hit, skill, clash, win) mixed into the recorded stream.
- **User**: An authenticated account with `id`, `email`, `password_hash`, `role`, and `created_at`.
- **Session**: The authenticated server session established at login and cleared at logout, carrying the User id and role.
- **Auth_Service**: The server-side authentication logic for register, login, and logout built on `nuxt-auth-utils`.
- **requireUser**: The centralized server utility that returns the authenticated User for a request or rejects the request when no valid Session exists.
- **can**: The centralized permission function `can(user, permission)` in `server/utils/permissions.ts`.
- **Protected_Route_Middleware**: The route middleware that restricts access to pages requiring an authenticated User.

## Requirements

### Requirement 1: Database and Schema (Phase 2)

**User Story:** As a developer, I want PostgreSQL and Drizzle ORM with migrations and a local database setup, so that account and content data has a type-safe, reproducible persistence layer.

#### Acceptance Criteria

1. THE Scaffold_App SHALL define a Drizzle ORM schema for a `users` table with columns `id` (primary key), `email` (text, not null), `password_hash` (text, not null), `role` (text, not null), and `created_at` (timestamp, not null, defaulting to the row insertion time).
2. THE Scaffold_App SHALL define the `users.email` column with a uniqueness constraint such that two rows with the same email value cannot coexist.
3. THE Scaffold_App SHALL define the `users.role` column constrained to exactly the values `superuser` and `viewer`, rejecting any other value.
4. THE Scaffold_App SHALL define, on every content table it declares, a `created_by` column that is not null and references `users.id` via a foreign key constraint.
5. THE Scaffold_App SHALL provide a migration mechanism that creates all defined tables, columns, and constraints in a PostgreSQL database.
6. THE Scaffold_App SHALL provide a `docker-compose.yml` that starts a single local PostgreSQL instance reachable on a configured host and port for development.
7. THE Scaffold_App SHALL provide a `.env.example` file listing every environment variable required to connect to PostgreSQL and run the Auth_Service, each with a non-secret placeholder value.
8. WHEN a developer runs the project's migration command against a reachable PostgreSQL database, THE Scaffold_App SHALL apply all pending migrations and emit a completion message naming the number of migrations applied, within 60 seconds.
9. IF the Scaffold_App cannot establish a PostgreSQL connection using the configured environment variables within a 10-second connection timeout, THEN THE Scaffold_App SHALL terminate the operation, retain any existing data unchanged, and emit an error message identifying the connection failure and the host and port attempted.

### Requirement 2: Account Registration (Phase 2)

**User Story:** As a visitor, I want to register an account with an email and password, so that I can log in and own saved content.

#### Acceptance Criteria

1. WHEN a visitor submits the registration form with an email that is not already present in the `users` table and a password, THE Auth_Service SHALL create a User with the submitted email, a password hash computed using the hashing provided by `nuxt-auth-utils`, and `created_at` set to the server UTC timestamp at creation time.
2. WHEN the Auth_Service creates a User during registration, THE Auth_Service SHALL assign the `role` value `superuser`.
3. THE Auth_Service SHALL store only the password hash and SHALL NOT store the submitted password in plaintext.
4. IF a visitor submits a registration email that already exists in the `users` table, THEN THE Auth_Service SHALL reject the registration, create no User record, and return an error indicating the email is already registered.
5. IF a visitor submits a registration form missing the email or the password, THEN THE Auth_Service SHALL reject the registration, create no User record, and return a validation error identifying each missing field.
6. IF a visitor submits a registration email that is not a syntactically valid email address, THEN THE Auth_Service SHALL reject the registration, create no User record, and return a validation error indicating the email format is invalid.
7. IF a visitor submits a registration password shorter than 8 characters or longer than 72 characters, THEN THE Auth_Service SHALL reject the registration, create no User record, and return a validation error indicating the password length requirement.
8. WHEN the Auth_Service successfully registers a User, THE Auth_Service SHALL establish an authenticated Session for that User.
9. THE register handler SHALL include a clearly marked TODO stating that before any public deployment the default role must become `viewer`.

### Requirement 3: Login, Logout, and Session (Phase 2)

**User Story:** As a registered user, I want to log in, stay logged in across visits, and log out, so that I can access my account securely.

#### Acceptance Criteria

1. WHEN a User submits login credentials whose email exists and whose password matches the stored hash, THE Auth_Service SHALL establish an authenticated Session carrying the User id and role.
2. IF a User submits login credentials whose email does not exist or whose password does not match the stored hash, THEN THE Auth_Service SHALL reject the login, establish no Session, leave the User in an unauthenticated state, and return an error that does not disclose which of the email or password was incorrect.
3. IF a User submits login credentials missing the email or the password, THEN THE Auth_Service SHALL reject the login, establish no Session, and return a validation error identifying each missing field.
4. WHILE an authenticated Session exists, WHEN the User reloads the Scaffold_App in the same browser, THE Auth_Service SHALL restore the authenticated state from the Session without requiring re-entry of credentials.
5. WHEN an authenticated User invokes logout, THE Auth_Service SHALL clear and remove the persisted Session so that a later load restores no authenticated state.
6. WHILE no authenticated Session exists, WHEN a User requests a protected route, THE Scaffold_App SHALL deny access to that route.
7. THE Session SHALL carry the User role, constrained to exactly one of `superuser` or `viewer`, so that `can` can evaluate permissions from the Session.

### Requirement 4: Centralized Authorization (Phase 2)

**User Story:** As a developer, I want all authorization to flow through centralized server utilities, so that access control is consistent and never depends on hidden UI.

#### Acceptance Criteria

1. WHEN `requireUser(event)` is invoked for a request carrying a Session that exists and is not expired, THE Scaffold_App SHALL return the authenticated User associated with that Session.
2. IF `requireUser(event)` is invoked for a request with no Session or with an expired Session, THEN THE Scaffold_App SHALL reject the request with an unauthenticated error, SHALL NOT return a User, and SHALL leave server-side state unchanged.
3. WHEN `can(user, permission)` is invoked, THE Scaffold_App SHALL evaluate the given permission for the given User and return a boolean result, where the function is defined in `server/utils/permissions.ts`.
4. WHILE a User has the role `superuser`, WHEN `can(user, permission)` is evaluated for any permission, THE Scaffold_App SHALL return true.
5. WHEN `can(user, permission)` is evaluated for a User whose role is not `superuser`, THE Scaffold_App SHALL return a boolean determined solely by that User's role and the requested permission, and SHALL NOT return true for a permission not granted to that role.
6. THE Scaffold_App SHALL route every server endpoint that requires authentication through `requireUser`, and SHALL route every authorization decision through `can`, such that no endpoint grants access without a `requireUser` result and no access decision bypasses `can`.
7. THE `permissions.ts` file SHALL include a clearly marked TODO stating that before any public deployment the default role must become `viewer` and a real permission map must be defined.
8. WHERE a page requires an authenticated User, WHEN an unauthenticated visitor requests that page, THE Protected_Route_Middleware SHALL prevent rendering of the page and redirect the visitor to the login page.

### Requirement 5: Deterministic Engine Core (Phase 3)

**User Story:** As a developer, I want a framework-free, deterministic simulation engine, so that the same seed and setup always produce identical duels and the engine can be unit-tested in isolation.

#### Acceptance Criteria

1. THE Engine SHALL contain zero Vue imports and zero Nuxt imports across every TypeScript source file located at any depth within `engine/`.
2. WHEN the Engine requires a random value, THE Engine SHALL derive it from a mulberry32 RNG seeded with an explicit 32-bit unsigned integer seed value in the range 0 to 4,294,967,295.
3. THE Engine SHALL NOT call `Math.random` and SHALL NOT read wall-clock time within any `engine/` source file.
4. THE Engine SHALL advance the World using a fixed Timestep of exactly 1/60 second (0.016666... seconds) for every Step.
5. WHEN the Engine iterates Entities during a Step, THE Engine SHALL process them in a stable order that is identical across all runs sharing the same input.
6. WHEN the Engine runs a duel twice with an identical seed and identical Duel_Config, THE Engine SHALL produce byte-for-byte identical final results, including the winner identifier and every Ball's final HP value.
7. WHEN the Engine advances a Step, THE Engine SHALL execute these operations exactly once each in this order: (1) move balls and weapons, (2) detect collisions, (3) resolve weapon clashes, (4) apply damage, (5) apply knockback, (6) run status effects, (7) check win condition.
8. THE Engine SHALL expose an `engineVersion` identifier as a non-empty string.
9. IF the Engine is seeded with a value outside the range 0 to 4,294,967,295 or a non-integer value, THEN THE Engine SHALL reject the seed and signal an error indicating an invalid seed, without advancing any Step.

### Requirement 6: Single Damage Gateway and Extensible Damage Sources (Phase 3)

**User Story:** As a developer, I want all HP changes to flow through one gateway with an extensible damage-source union, so that damage logic stays consistent and new attack types can be added without rework.

#### Acceptance Criteria

1. THE Engine SHALL reduce a Ball's HP only through the `applyDamage` function, which accepts `{ source, attackerId, targetId, amount, flags }`.
2. WHEN `applyDamage` is invoked with an `amount` less than or equal to zero, THE Engine SHALL NOT change the target Ball's HP and SHALL return without emitting a `damage` Engine_Event.
3. WHEN `applyDamage` is invoked with a `targetId` that matches no living Ball, THE Engine SHALL NOT change any Ball's HP and SHALL return an outcome indicating the target was not found.
4. THE Engine SHALL define Damage_Source as a tagged union whose members in Phases 3-5 are exactly `contact`, `weapon`, and `projectile`.
5. THE Engine SHALL define the Damage_Source union with the reserved, unimplemented members `area`, `dot`, `environment`, `beam`, `summon`, and `reflect`, such that adding any reserved member requires no change to the `applyDamage` signature.
6. WHEN `applyDamage` is invoked with a `source` tag not listed among the active or reserved Damage_Source members, THE Engine SHALL NOT change any Ball's HP and SHALL return an outcome indicating the source is invalid.
7. WHERE a damage interaction has no attacker, THE `applyDamage` function SHALL accept an empty `attackerId` and SHALL still reduce the target Ball's HP by `amount`.
8. WHERE damage originates from a summon, THE Engine SHALL set the credited attacker to the summon's owner identifier in the emitted `damage` Engine_Event.
9. WHEN `applyDamage` is invoked with the `isReflected` flag set, THE Engine SHALL apply the damage once and SHALL NOT produce any further reflected damage from that invocation.
10. WHEN `applyDamage` reduces a Ball's HP by a positive amount, THE Engine SHALL emit exactly one `damage` Engine_Event that includes the Damage_Source, `attackerId`, `targetId`, and applied `amount`.
11. WHEN `applyDamage` reduces a Ball's HP to zero or below, THE Engine SHALL set that Ball's HP to zero, SHALL mark that Ball as dead, and SHALL emit exactly one `ballDied` Engine_Event.

### Requirement 7: Status Effect System and Hit Cooldowns (Phase 3)

**User Story:** As a developer, I want a status-effect system and per-pair hit cooldowns wired into the step from day one, so that timed effects and repeat-hit prevention work before any skill or weapon uses them.

#### Acceptance Criteria

1. THE Engine SHALL maintain for each Ball a list of Status_Effects, each with a remaining duration of zero or more whole Timesteps and a tick interval of one or more whole Timesteps.
2. WHEN the Engine runs the status-effect operation during a Step, THE Engine SHALL decrement each Status_Effect's remaining duration by one Timestep.
3. WHEN a Status_Effect's elapsed time since its last tick reaches its tick interval, THE Engine SHALL apply that Status_Effect's per-tick behavior once and SHALL reset that Status_Effect's elapsed-since-last-tick counter to zero.
4. WHEN a Status_Effect's remaining duration reaches zero, THE Engine SHALL remove that Status_Effect from its Ball.
5. THE Engine SHALL maintain a Hit_Cooldown per attacker-target pair, where a Hit_Cooldown is active while its remaining time is greater than zero.
6. WHEN the Engine starts a Hit_Cooldown for an attacker-target pair, THE Engine SHALL set that pair's remaining cooldown time to the applicable cooldown duration.
7. WHILE a Hit_Cooldown for an attacker-target pair is active, IF the Engine resolves a repeated hit between that same pair, THEN THE Engine SHALL apply no damage, no knockback, and no status change for that pair and SHALL leave both Balls' state unchanged for that interaction.
8. WHEN the Engine advances a Step, THE Engine SHALL decrement each active Hit_Cooldown's remaining time by one Timestep.
9. THE Engine SHALL execute the status-effect operation in each Step after applying damage and knockback and before checking the win condition.

### Requirement 8: Ball and Arena Physics (Phase 3)

**User Story:** As a user, I want balls to move and bounce within the arena with hand-written collision, so that duels play out physically without a physics library.

#### Acceptance Criteria

1. WHEN the Engine advances a Step, THE Engine SHALL update each alive Ball's position by adding the product of its velocity and the fixed Timestep duration to its current position.
2. WHEN a Ball's distance from an Arena wall along that wall's normal axis becomes less than or equal to the Ball's radius, THE Engine SHALL negate the Ball's velocity component normal to that wall and SHALL reposition the Ball so its edge is tangent to the wall, keeping the entire Ball within the Arena bounds.
3. WHEN a Ball bounces off an Arena wall, THE Engine SHALL emit the condition that triggers the `onWallBounce` skill hook exactly once per bounce event.
4. WHEN the distance between the centers of two alive Balls becomes less than or equal to the sum of their radii, THE Engine SHALL detect a collision and SHALL reposition both Balls along the line between their centers until the center distance equals the sum of their radii.
5. IF two Balls collide and a colliding Ball has a `contactDamage` greater than 0 and no active Hit_Cooldown exists for that ordered pair, THEN THE Engine SHALL apply that `contactDamage` through `applyDamage` with Damage_Source `contact` and SHALL start the Hit_Cooldown for that pair.
6. WHEN a hit occurs, THE Engine SHALL apply a Knockback impulse to the struck Ball directed along the line from the striking Ball's center to the struck Ball's center.
7. WHILE two or more Balls remain alive, THE Engine SHALL continue running Steps and SHALL NOT emit a `matchEnded` Engine_Event.
8. WHEN exactly one Ball remains alive, THE Engine SHALL declare that Ball the winner and SHALL emit a `matchEnded` Engine_Event exactly once.
9. IF zero Balls remain alive after a Step, THEN THE Engine SHALL end the match with no winner and SHALL emit a `matchEnded` Engine_Event exactly once.

### Requirement 9: Skill System and Starter Skills (Phase 4)

**User Story:** As a developer, I want a data-driven skill system with lifecycle hooks and five starter skills, so that balls have varied behavior and new skills can be added as single files.

#### Acceptance Criteria

1. THE Scaffold_App SHALL define each Skill as a single file in `engine/skills/`, each registered in the Skill_Registry under a unique non-empty skill id.
2. THE Skill system SHALL support exactly the hooks `onTick`, `onHit`, `onHurt`, `onWallBounce`, and `onDeath`.
3. WHEN the Engine triggers a Skill hook that resolves from a damage interaction, THE Engine SHALL make the triggering Damage_Source readable by the Skill.
4. WHEN a Skill triggers, THE Engine SHALL emit exactly one `skillTriggered` Engine_Event identifying the triggered Skill.
5. IF a Skill id referenced by a Ball configuration is not present in the Skill_Registry, THEN THE Engine SHALL reject that Ball configuration and surface an error identifying the unknown skill id.
6. WHERE a Ball has the Vampire skill, WHEN that Ball deals damage through `applyDamage`, THE Engine SHALL heal that Ball by a configuration-defined fraction of the damage dealt, clamped so the Ball's HP does not exceed its maximum HP.
7. WHERE a Ball has the Spike skill, WHEN that Ball takes `contact` damage from an attacker, THE Engine SHALL apply a configuration-defined reflected damage amount to the attacker through `applyDamage` with the `isReflected` flag set.
8. WHERE a Ball has the Blaster skill, WHEN the configuration-defined firing interval elapses during `onTick`, THE Engine SHALL spawn one projectile Entity credited to that Ball.
9. WHERE a Ball has the Splitter skill, WHEN that Ball dies, THE Engine SHALL spawn the configuration-defined number of smaller Balls on `onDeath`, each with a configuration-defined reduced radius.
10. WHERE a Ball has the Grower skill, WHEN that Ball bounces off an Arena wall, THE Engine SHALL increase that Ball's radius and speed by the configuration-defined amounts on `onWallBounce`.

### Requirement 10: Weapon System and Starter Weapons (Phase 5)

**User Story:** As a developer, I want a data-driven weapon system with held and orbit modes plus five starter weapons, so that balls can carry weapons and weapon interactions resolve consistently.

#### Acceptance Criteria

1. THE Scaffold_App SHALL define each Weapon as a single definition in `engine/weapons/` registered in the Weapon_Registry, with required fields `id` (unique non-empty string), `name` (non-empty string), `mode` (one of `held` or `orbit`), `length` (number greater than 0), `damage` (number of 0 or greater), `angularSpeed` (number in radians per second), `weight` (number greater than 0), `hitCooldown` (duration of 0 or greater in milliseconds), and `hitbox`, plus optional projectile settings.
2. IF a Weapon definition is missing any required field or any field value falls outside its specified bound, THEN THE Scaffold_App SHALL reject the Weapon definition at registration, SHALL exclude it from the Weapon_Registry, and SHALL surface an error indicating the offending field.
3. THE Weapon system SHALL support exactly the modes `held` and `orbit` and SHALL support no other mode value.
4. WHILE a Weapon is in `orbit` mode, WHEN the Engine advances a Step, THE Engine SHALL increase the Weapon angle by `angularSpeed` multiplied by the Timestep and SHALL set the Weapon position to the owner Ball position plus its direction unit vector multiplied by the orbit radius.
5. WHILE a Weapon is in `held` mode, WHEN the Engine advances a Step, THE Engine SHALL set the Weapon position to the owner Ball position and SHALL orient the Weapon toward the target.
6. WHEN a Weapon hitbox overlaps an opposing Ball AND no active `hitCooldown` exists for that attacker-target pair, THE Engine SHALL apply the Weapon's `damage` through `applyDamage` with Damage_Source `weapon` and SHALL start a `hitCooldown` for that attacker-target pair.
7. WHILE a `hitCooldown` is active for an attacker-target pair, IF the same Weapon hitbox overlaps the same opposing Ball, THEN THE Engine SHALL NOT apply damage for that pair.
8. WHEN two Weapon hitboxes overlap, THE Engine SHALL resolve a Weapon_Clash whose outcome is exactly one of bounce, parry, or disarm determined by the two Weapons' `weight` values, and SHALL apply no direct damage from the clash.
9. WHEN a Weapon_Clash resolves, THE Engine SHALL emit exactly one `weaponClash` Engine_Event.
10. WHERE a Weapon has projectile settings, WHEN the Weapon fires, THE Engine SHALL spawn one projectile Entity, and WHEN that projectile overlaps an opposing Ball THE Engine SHALL apply damage through `applyDamage` with Damage_Source `projectile` credited to the owner Ball.
11. THE Weapon_Registry SHALL include exactly these five starter weapons: Sword (`held`), Hammer (`held`, heaviest `weight` among starter weapons, cannot be parried), Spear (`held`, greatest `length` among starter weapons), Orbiting blade (`orbit`), and Bow (projectile settings present).
12. WHERE a clashing Weapon is the Hammer, WHEN the Weapon_Clash resolves, THE Engine SHALL NOT produce a parry outcome for the Hammer.

### Requirement 11: Versus Page and Rendering (Phase 6)

**User Story:** As a user, I want to pick two balls, run a duel on a canvas with HP bars, and see who wins with a rematch option, so that I can watch and replay battles.

#### Acceptance Criteria

1. THE Versus_Page SHALL allow a user to select exactly two balls from the Library_Store, Roulette results, or provided default balls.
2. IF a user attempts to start a duel with fewer than two balls selected or more than two balls selected, THEN THE Versus_Page SHALL block the duel start and display an error indication identifying that exactly two balls are required.
3. THE Scaffold_App SHALL provide at least two default balls so that the Versus_Page can run a duel without any login and without any saved content.
4. THE Versus_Page SHALL allow a user to configure the Arena into a Duel_Config before running a duel.
5. WHEN a user starts a duel on the Versus_Page, THE Renderer SHALL draw the World to an HTML Canvas 2D context once per Engine frame, driven by the Engine's fixed Timestep.
6. THE Renderer SHALL run only on the client and SHALL NOT execute during server-side rendering.
7. WHILE a duel is running, THE Versus_Page SHALL display one HP bar per Ball whose filled proportion equals that Ball's current HP divided by that Ball's maximum HP, clamped to the range 0 to 1.
8. THE Versus_Page SHALL read only HP, winner, and Engine_Events from the Engine for display, and SHALL NOT bind per-frame Engine state into Vue reactivity.
9. WHEN the Engine emits `matchEnded`, THE Versus_Page SHALL display a winner screen identifying the winning Ball within 100 milliseconds of receiving the event.
10. WHEN a user activates the rematch control after a duel ends, THE Versus_Page SHALL run the duel again using the same Duel_Config and produce a result identical to the previous duel, where identical means the same winning Ball and the same final HP value for each Ball.
11. WHEN the Versus_Page component is unmounted, THE Scaffold_App SHALL dispose the Engine instance, cancel its `requestAnimationFrame` loop, and remove its event listeners.

### Requirement 12: Roulette (Phase 7)

**User Story:** As a user, I want to spin a seeded roulette to draw skills and weapons for a ball, so that I get reproducible randomized loadouts.

#### Acceptance Criteria

1. WHEN a user spins the Roulette with a provided integer seed, THE Roulette SHALL draw exactly one skill and exactly one weapon for a Ball using the seeded RNG, selecting only from entries present in the Skill_Registry and Weapon_Registry at spin time.
2. IF a user spins the Roulette without providing a seed, THEN THE Roulette SHALL generate an integer seed, record it with the result, and complete the spin within 2 seconds.
3. WHEN a user spins the Roulette twice with the same seed and the same Skill_Registry and Weapon_Registry contents, THE Roulette SHALL produce identical skill and weapon selections across both spins.
4. IF the Skill_Registry or Weapon_Registry contains zero entries at spin time, THEN THE Roulette SHALL reject the spin, retain any previously drawn result, and present an error indication identifying the empty registry.
5. THE Roulette SHALL reference only existing Skill and Weapon definitions and SHALL NOT create, modify, or delete any skill or weapon behavior.
6. THE Roulette SHALL complete a spin without an authenticated User, reading from and writing to local persistence only.
7. WHEN a user chooses to save a Roulette result, THE Scaffold_App SHALL store the resulting Ball configuration, including the seed used, in the Library_Store.
8. IF saving a Roulette result to the Library_Store fails, THEN THE Scaffold_App SHALL retain the unsaved result and present an error indication reporting the save failure.

### Requirement 13: Library and Local Persistence (Phase 7)

**User Story:** As a user, I want saved balls, skills, and weapons kept locally with JSON export and import, so that my content persists across sessions and is portable.

#### Acceptance Criteria

1. THE Library_Store SHALL hold saved balls, skills, and weapons, each entry retaining its configuration data and a unique identifier.
2. WHEN the Library_Store state changes, THE Scaffold_App SHALL persist the Library_Store to browser localStorage within 1 second of the change.
3. IF persisting the Library_Store to browser localStorage fails because the storage quota is exceeded or localStorage is unavailable, THEN THE Scaffold_App SHALL retain the in-memory Library_Store unchanged and surface an error indicating that the save failed.
4. WHEN the Scaffold_App loads, THE Scaffold_App SHALL restore the Library_Store from browser localStorage.
5. IF the stored Library_Store data is absent or cannot be parsed as valid JSON during load, THEN THE Scaffold_App SHALL initialize the Library_Store to an empty state containing zero balls, zero skills, and zero weapons without surfacing a blocking error.
6. WHEN a user requests export, THE Scaffold_App SHALL produce a single JSON document containing the complete Library_Store and Settings_Store contents.
7. WHEN a user imports a JSON document whose structure matches the exported shape, THE Scaffold_App SHALL replace the Library_Store and Settings_Store contents with the imported contents.
8. IF a user imports a JSON document that is not valid JSON or whose structure does not match the exported shape, THEN THE Scaffold_App SHALL reject the import and surface an error indicating the import is invalid, leaving the existing Library_Store and Settings_Store contents unchanged.
9. WHEN a user saves a Duel, THE Scaffold_App SHALL store the Duel as `{ engineVersion, seed, ballConfigs, arenaConfig }` and SHALL set `engineVersion` to the current engine version at save time.
10. THE Library_Store and Settings_Store data shapes SHALL be serializable to JSON so that later server-side sync requires no shape change.

### Requirement 14: Recording and Audio (Phase 8)

**User Story:** As a user, I want to record a duel as a downloadable video with sound, so that I can save and share battles.

#### Acceptance Criteria

1. WHEN a user starts recording a duel, THE Recorder SHALL capture the canvas using `canvas.captureStream(60)` at 60 frames per second and encode the stream with `MediaRecorder`.
2. WHEN selecting the recording container and codec, THE Recorder SHALL prefer WebM, and SHALL use `MediaRecorder.isTypeSupported` to select the first supported type from an ordered fallback list before starting recording.
3. IF no candidate container or codec is supported by `MediaRecorder.isTypeSupported`, THEN THE Recorder SHALL abort the recording and SHALL surface an error indicating that recording is unsupported, without saving any partial recording.
4. THE Recorder SHALL render the recording at the configured resolution, independent of the on-screen display size.
5. WHEN a hit, skill, clash, or win event occurs, THE Audio_Layer SHALL produce the corresponding sound using Web Audio, and SHALL mix that audio into the recorded stream so the saved recording contains both video and audio tracks.
6. WHEN a user activates Auto record, THE Scaffold_App SHALL start the duel, start recording, stop recording within 2 seconds after the winner is determined, and save the recording.
7. WHEN a recording completes, THE Scaffold_App SHALL store the recording blob in IndexedDB, and SHALL store the recording's metadata in the Recordings_Store.
8. IF storing the recording blob in IndexedDB fails, THEN THE Scaffold_App SHALL surface an error indicating that the recording could not be saved, and SHALL NOT create a metadata entry in the Recordings_Store.
9. WHEN the recordings page loads, THE recordings page SHALL list all saved recordings held in the Recordings_Store.
10. WHEN a user selects a saved recording, THE recordings page SHALL play back the selected recording, and SHALL allow the user to download the selected recording.
11. THE Recorder and Audio_Layer SHALL run only on the client.

### Requirement 15: Settings (Phase 9)

**User Story:** As a user, I want to configure resolution, aspect ratio, sound, and simulation speed, so that recordings and playback match my target format.

#### Acceptance Criteria

1. THE Settings_Store SHALL hold a resolution (width and height each an integer from 1 to 7680 pixels), an aspect ratio, a sound setting (enabled or disabled), and a simulation speed (a number from 0.1 to 10.0).
2. WHEN the Settings_Store is first initialized with no persisted values, THE Settings_Store SHALL default the aspect ratio to 9:16, the resolution to 1080x1920, the sound setting to enabled, and the simulation speed to 1.0.
3. WHEN the Settings_Store state changes, THE Scaffold_App SHALL persist the Settings_Store to browser localStorage within 1 second of the change.
4. WHEN the Scaffold_App loads, THE Scaffold_App SHALL restore the Settings_Store from browser localStorage.
5. IF a persisted Settings_Store value is absent or falls outside its specified bound during load, THEN THE Scaffold_App SHALL replace that value with its default and continue loading without a blocking error.
6. WHERE the sound setting is disabled, WHEN a duel runs, THE Audio_Layer SHALL produce no audible output.
7. WHERE a simulation speed is configured, WHEN a duel runs, THE Scaffold_App SHALL advance the number of Engine Steps per real-time second scaled by the configured simulation speed, without changing the fixed Timestep used within each Step.
8. WHERE the resolution is configured, WHEN a duel is recorded, THE Recorder SHALL render at the configured resolution.

### Requirement 16: Reduced Motion and Keyboard Accessibility (Phase 9)

**User Story:** As a user with accessibility needs, I want reduced-motion support and keyboard-operable menus with visible focus, so that I can use the app comfortably.

#### Acceptance Criteria

1. WHILE the user agent reports `prefers-reduced-motion: reduce`, THE Scaffold_App SHALL render all decorative and transitional UI animation with zero visible motion, applying any state change as an instantaneous transition of 0 ms.
2. WHILE the user agent reports `prefers-reduced-motion: reduce`, THE Scaffold_App SHALL continue advancing and displaying the simulation at the same fixed-timestep rate and outcome as when reduced motion is not requested.
3. THE Scaffold_App SHALL make every menu control reachable and activatable using only the keyboard, where Tab and Shift+Tab move focus between controls and Enter or Space activates the focused control.
4. WHILE any menu control holds keyboard focus, THE Scaffold_App SHALL display a focus indicator on that control that is visually distinct from every unfocused control and SHALL display the focus indicator on exactly one control at a time.
5. WHILE a duel displays, THE Versus_Page SHALL present a hit-flash lasting between 50 ms and 500 ms on each registered hit.
6. WHEN a hit is registered during a duel, THE Versus_Page SHALL present visual feedback whose appearance differs for each of the contact, weapon, and projectile Damage_Source values such that the originating Damage_Source is distinguishable from the other two by sight alone.

### Requirement 17: Documentation and Deployment Safety (Phase 9)

**User Story:** As a developer, I want documentation covering architecture, setup, and extension, and a clear not-ready-for-public-deployment marker, so that the project is maintainable and not deployed prematurely.

#### Acceptance Criteria

1. THE README SHALL contain an architecture section that documents each major component of the Scaffold_App, the responsibilities of each component, and the data flow between them.
2. THE README SHALL contain a local setup section that documents the prerequisite tooling with required versions, the dependency installation steps, and the exact command used to run the Scaffold_App locally.
3. THE README SHALL contain an extension section with separate, step-by-step procedures for adding a Skill, adding a Weapon, and adding a new Damage_Source, where each procedure lists the files to create or modify and the steps to complete the addition.
4. THE README SHALL contain a determinism section that documents how deterministic behavior is achieved and how `engineVersion` is defined, incremented, and used.
5. THE README SHALL contain a roles section that documents how roles are intended to evolve and states that the default role must change from its current value to `viewer` before public deployment.
6. WHILE the default role is not `viewer`, THE Scaffold_App SHALL display a persistent, visible notice on every rendered page indicating that the app is not ready for public deployment until roles are implemented.
