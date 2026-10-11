import type { WeaponBehavior } from '../behavior'

export interface RiposteConfig {
  readonly multiplier: number // × damage of the next hit
  readonly windowSteps: number // how long the riposte stays ready
  readonly spinBoost?: number // × spin while ready
  readonly reflectProjectiles?: boolean // while ready, send projectiles back instead of blocking them
  readonly launchSpeed?: number // the boosted hit sends the ball straight away at this speed (no wall slam)
}

/**
 * Riposte (Sword): after any clash, even one the weapon is disarmed in, a
 * riposte is ready for `windowSteps`: the next hit deals `multiplier` × damage
 * (and, with `launchSpeed`, knocks the ball away). While ready, the blade spins
 * `spinBoost` × faster, turned toward the opponent, and (if
 * `reflectProjectiles`) sends opposing projectiles it touches back at their
 * shooter. Spent by the boosted hit.
 */
export function riposte(config: RiposteConfig): WeaponBehavior<{ steps: number; landing: boolean }> {
  return {
    id: 'riposte',
    init: () => ({ steps: 0, landing: false }),
    spinMultiplier: (s) => (s.steps > 0 ? (config.spinBoost ?? 1) : 1),
    onStep(_ctx, s) {
      if (s.steps > 0) s.steps -= 1
    },
    onClash({ weapon, owner, nearestOpponent }, s) {
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
      s.landing = s.steps > 0
      if (!s.landing) return 1
      s.steps = 0 // spent
      return config.multiplier
    },
    afterHit(_ctx, s, _target, hit) {
      if (s.landing && config.launchSpeed) hit.knockback = { launchSpeed: config.launchSpeed }
      s.landing = false
    },
    projectileResponse: (s) => (config.reflectProjectiles && s.steps > 0 ? 'reflect' : undefined),
    active: (s) => s.steps > 0,
  }
}
