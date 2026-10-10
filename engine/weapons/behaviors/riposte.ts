import type { WeaponBehavior } from '../behavior'

export interface RiposteConfig {
  readonly multiplier: number // × damage of the next hit
  readonly windowSteps: number // how long the riposte stays ready
  readonly spinBoost?: number // × spin while ready
  readonly reflectProjectiles?: boolean // while ready, send projectiles back instead of blocking them
}

/**
 * Riposte (Sword): after any clash the weapon isn't disarmed in, a riposte is
 * ready for `windowSteps`: the next hit deals `multiplier` × damage. While
 * ready, the blade spins `spinBoost` × faster, turned toward the opponent, and
 * (if `reflectProjectiles`) sends opposing projectiles it touches back at their
 * shooter. Spent by the boosted hit.
 */
export function riposte(config: RiposteConfig): WeaponBehavior<{ steps: number }> {
  return {
    id: 'riposte',
    init: () => ({ steps: 0 }),
    spinMultiplier: (s) => (s.steps > 0 ? (config.spinBoost ?? 1) : 1),
    onStep(_ctx, s) {
      if (s.steps > 0) s.steps -= 1
    },
    onClash({ weapon, owner, nearestOpponent }, s, won) {
      if (!won) return
      s.steps = config.windowSteps
      // Turn the spin toward the opponent, the shortest way round, for the burst.
      const foe = nearestOpponent()
      if (foe) {
        let d = Math.atan2(foe.position.y - owner.position.y, foe.position.x - owner.position.x) - weapon.angle
        d = Math.atan2(Math.sin(d), Math.cos(d)) // wrap to (-π, π]
        weapon.angularSpeed = Math.sign(d || 1) * Math.abs(weapon.def.angularSpeed)
      }
    },
    hitMultiplier(_ctx, s) {
      if (s.steps <= 0) return 1
      s.steps = 0 // spent
      return config.multiplier
    },
    projectileResponse: (s) => (config.reflectProjectiles && s.steps > 0 ? 'reflect' : undefined),
    active: (s) => s.steps > 0,
  }
}
