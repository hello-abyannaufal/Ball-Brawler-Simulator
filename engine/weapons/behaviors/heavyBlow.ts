import type { Ball, Vec2, WeaponEntity } from '../../entities'
import type { WeaponBehavior } from '../behavior'

export interface HeavyBlowConfig {
  /** Launch the struck ball straight away at this speed (replaces its velocity). */
  readonly launchSpeed: number
  /** The weapon's spin reverses on a hit, so it bounces off the ball. */
  readonly reboundOnHit?: boolean
  /** If the struck ball hits a wall within `windowSteps`, it takes `damage` once more. */
  readonly wallSlam?: { readonly damage: number; readonly windowSteps: number }
}

/** Heavy blow (Hammer): a hit sends the ball flying the way the head was
 *  swinging (tangent to its orbit), and may slam it into a wall. */
export function heavyBlow(config: HeavyBlowConfig): WeaponBehavior<null> {
  return {
    id: 'heavy-blow',
    init: () => null,
    afterHit({ weapon, owner }, _s, _target, hit) {
      // Taken before a rebound flips the spin.
      hit.knockback = { launchSpeed: config.launchSpeed, direction: swingDirection(weapon, owner) }
      if (config.reboundOnHit) weapon.angularSpeed = -weapon.angularSpeed
      if (config.wallSlam) hit.wallSlam = { ...config.wallSlam }
    },
    heavyHit: () => true,
  }
}

/** Unit direction the weapon is moving along its orbit around `owner`. */
function swingDirection(weapon: WeaponEntity, owner: Ball): Vec2 | undefined {
  const rx = weapon.position.x - owner.position.x
  const ry = weapon.position.y - owner.position.y
  const len = Math.sqrt(rx * rx + ry * ry)
  if (len === 0 || weapon.angularSpeed === 0) return undefined
  const spin = Math.sign(weapon.angularSpeed)
  return { x: (-ry / len) * spin, y: (rx / len) * spin }
}
