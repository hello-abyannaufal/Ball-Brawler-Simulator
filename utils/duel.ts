import type { BallConfig } from '~/engine/config'

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
      appearance: { type: 'color', value: '#e43b44' },
    },
    {
      id: 'default-blue',
      radius: 32,
      maxHp: 100,
      initialPosition: { x: 220, y: 180 },
      initialVelocity: { x: -180, y: -90 },
      weapons: [{ weaponId: 'spear' }],
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

/**
 * Put two picked balls into duel start slots (left / right, mirrored
 * velocities) so any pair — default or from the Library — starts the same
 * fair way. Configs are copied, never mutated. If both balls would render the
 * same solid color, the second is recolored so they stay distinguishable.
 */
export function placeForDuel(
  configs: readonly BallConfig[],
  arena: { width: number; height: number },
): BallConfig[] {
  const slots = [
    { x: (arena.width * 7) / 18, vx: 180, vy: 90 },
    { x: (arena.width * 11) / 18, vx: -180, vy: -90 },
  ]
  const placed = configs.map((c, i): BallConfig => {
    const slot = slots[i % slots.length]!
    return {
      // JSON round-trip, not structuredClone: Library configs arrive as Pinia
      // reactive proxies, which structuredClone rejects. BallConfig is JSON-safe.
      ...(JSON.parse(JSON.stringify(c)) as BallConfig),
      initialPosition: { x: slot.x, y: arena.height / 2 },
      initialVelocity: { x: slot.vx, y: slot.vy },
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
