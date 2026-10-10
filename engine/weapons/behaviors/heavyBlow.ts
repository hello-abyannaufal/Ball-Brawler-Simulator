import type { WeaponBehavior } from '../behavior'

export interface HeavyBlowConfig {
  /** Launch the struck ball straight away at this speed (replaces its velocity). */
  readonly launchSpeed: number
  /** The weapon's spin reverses on a hit, so it bounces off the ball. */
  readonly reboundOnHit?: boolean
  /** If the struck ball hits a wall within `windowSteps`, it takes `damage` once more. */
  readonly wallSlam?: { readonly damage: number; readonly windowSteps: number }
}

/** Heavy blow (Hammer): a hit sends the ball flying, and may slam it into a wall. */
export function heavyBlow(config: HeavyBlowConfig): WeaponBehavior<null> {
  return {
    id: 'heavy-blow',
    init: () => null,
    afterHit({ weapon }, _s, _target, hit) {
      hit.knockback = { launchSpeed: config.launchSpeed }
      if (config.reboundOnHit) weapon.angularSpeed = -weapon.angularSpeed
      if (config.wallSlam) hit.wallSlam = { ...config.wallSlam }
    },
  }
}
