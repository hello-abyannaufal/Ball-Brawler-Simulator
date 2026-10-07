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
      contactDamage: 6,
      initialPosition: { x: 140, y: 180 },
      initialVelocity: { x: 180, y: 90 },
      skills: [],
      weapons: [{ weaponId: 'sword' }],
      appearance: { type: 'color', value: '#e43b44' },
    },
    {
      id: 'default-blue',
      radius: 32,
      maxHp: 100,
      contactDamage: 6,
      initialPosition: { x: 220, y: 180 },
      initialVelocity: { x: -180, y: -90 },
      skills: [],
      weapons: [{ weaponId: 'spear' }],
      appearance: { type: 'color', value: '#0099db' },
    },
  ]
}
