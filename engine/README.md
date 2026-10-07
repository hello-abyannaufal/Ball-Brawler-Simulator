# Engine

Framework-free, pure TypeScript. **Zero Vue/Nuxt imports** at any depth in this
directory. The engine owns simulation state and must be unit-testable with
Vitest in isolation from the UI.

Conventions:

- Deterministic: seeded RNG (mulberry32) and a fixed timestep. No `Math.random()`
  or wall-clock time inside the engine.
- Data-driven: one file per skill in `engine/skills/`, one definition per weapon
  in `engine/weapons/`, with central registries.

(Phase 1 scaffold — directories are intentionally empty placeholders.)
