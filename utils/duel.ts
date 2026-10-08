import type { BallConfig } from '~/engine/config'
import type { Vec2 } from '~/engine/entities'
import { createRng } from '~/engine/rng'
import { ballStats } from '~/engine/races/registry'
import '~/engine/races/index' // populate the registry

/**
 * HP bar fill fraction, clamped to [0, 1] (Req 11.7). Pure.
 * Guards against maxHp <= 0 and NaN.
 */
export function hpBarFraction(hp: number, maxHp: number): number {
  if (!(maxHp > 0)) return 0
  const f = hp / maxHp
  if (Number.isNaN(f)) return 0
  return Math.min(1, Math.max(0, f))
}

/**
 * At least two default balls so Versus runs without any login or saved content
 * (Req 11.3). Positions/velocities are set so a duel actually happens; the
 * arena is configured by the versus page.
 */
export function defaultBalls(): BallConfig[] {
  // Positioned for a 360×360 (1:1) arena, big balls kept close so weapons
  // clash often.
  return [
    {
      id: 'default-red',
      radius: 32,
      maxHp: 100,
      initialPosition: { x: 140, y: 180 },
      initialVelocity: { x: 180, y: 90 },
      weapons: [{ weaponId: 'sword' }],
      raceId: 'human',
      appearance: { type: 'color', value: '#e43b44' },
    },
    {
      id: 'default-blue',
      radius: 32,
      maxHp: 100,
      initialPosition: { x: 220, y: 180 },
      initialVelocity: { x: -180, y: -90 },
      weapons: [{ weaponId: 'spear' }],
      raceId: 'human',
      appearance: { type: 'color', value: '#0099db' },
    },
  ]
}

/**
 * Whole engine steps owed for `realSeconds` of wall time at `speed` (Req 15.7).
 * Speed scales how MANY 1/60 s steps run per real second; each step's
 * timestep stays exactly 1/60 s. Pure.
 */
export function stepsForElapsed(realSeconds: number, speed: number): number {
  if (!(realSeconds > 0) || !(speed > 0)) return 0
  // Epsilon guards float error (e.g. 0.1 * 60 = 5.999…).
  return Math.floor(realSeconds * 60 * speed + 1e-9)
}

/** Fallback colors when two picked balls would look the same. */
const DUEL_COLORS = ['#e43b44', '#0099db', '#63c74d', '#b55088']

/** Start speed of every ball in a duel (same for any pair, so it stays fair). */
const START_SPEED = Math.hypot(180, 90)
/** Minimum distance between the two start centers, as a fraction of the arena's smaller side. */
const MIN_START_GAP = 0.45

/**
 * Place two picked balls at random, well-separated start positions with
 * random headings, all derived from `seed` (same seed → same start, so Rematch
 * replays the identical duel). Positions keep each ball inside the arena with
 * a margin, and the two centers are at least MIN_START_GAP × the arena's
 * smaller side apart. Configs are copied, never mutated. If both balls would
 * render the same solid color, the second is recolored.
 */
export function placeForDuel(
  configs: readonly BallConfig[],
  arena: { width: number; height: number },
  seed: number,
): BallConfig[] {
  // Own RNG stream (decorrelated from the engine's, which also uses `seed`).
  const rng = createRng((seed ^ 0x9e3779b9) >>> 0)
  const minGap = Math.min(arena.width, arena.height) * MIN_START_GAP
  const spots: Vec2[] = []
  const placed = configs.map((c): BallConfig => {
    const margin = ballStats(c).radius + 8
    let pos: Vec2 = { x: arena.width / 2, y: arena.height / 2 }
    // Rejection-sample a spot far enough from the others (bounded tries).
    for (let tries = 0; tries < 200; tries++) {
      pos = {
        x: margin + rng.next() * (arena.width - 2 * margin),
        y: margin + rng.next() * (arena.height - 2 * margin),
      }
      if (spots.every((s) => Math.hypot(s.x - pos.x, s.y - pos.y) >= minGap)) break
    }
    spots.push(pos)
    const heading = rng.next() * Math.PI * 2
    return {
      // JSON round-trip, not structuredClone: Library configs arrive as Pinia
      // reactive proxies, which structuredClone rejects. BallConfig is JSON-safe.
      ...(JSON.parse(JSON.stringify(c)) as BallConfig),
      initialPosition: pos,
      initialVelocity: { x: Math.cos(heading) * START_SPEED, y: Math.sin(heading) * START_SPEED },
    }
  })
  const [a, b] = placed
  const colorA = a?.appearance?.type === 'color' ? a.appearance.value.toLowerCase() : null
  const colorB = b?.appearance?.type === 'color' ? b.appearance.value.toLowerCase() : null
  if (b && colorA && colorA === colorB) {
    b.appearance = { type: 'color', value: DUEL_COLORS.find((c) => c !== colorA)! }
  }
  return placed
}
