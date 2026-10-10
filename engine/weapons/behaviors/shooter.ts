import { invalid, type WeaponBehavior } from '../behavior'

export interface ProjectileSettings {
  speed: number
  radius: number
  damage: number
  fireInterval: number // steps
  /** Fires only while the weapon points within ±this many degrees of the
   *  nearest opponent (default 15). */
  facingDegrees?: number
  /** Opposing bladed weapons can swat these projectiles out of the air. */
  blockable?: boolean
}

const DEFAULT_FACING_DEGREES = 15

/** Smallest absolute difference between two angles, in [0, π]. */
function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d)
}

/**
 * Shooter (Bow): fires a projectile only while the weapon faces an opponent
 * AND the fire interval is ready (Req 10.10). Range does not matter. The
 * weapon itself can't swat projectiles.
 */
export function shooter(config: ProjectileSettings): WeaponBehavior<{ timer: number }> {
  if (!(config.speed > 0)) invalid('projectile.speed', 'must be > 0')
  if (!(config.radius > 0)) invalid('projectile.radius', 'must be > 0')
  if (!(config.damage >= 0)) invalid('projectile.damage', 'must be >= 0')
  if (!(config.fireInterval >= 1) || !Number.isInteger(config.fireInterval)) {
    invalid('projectile.fireInterval', 'must be an integer >= 1')
  }
  const cone = ((config.facingDegrees ?? DEFAULT_FACING_DEGREES) * Math.PI) / 180
  return {
    id: 'shooter',
    init: () => ({ timer: config.fireInterval }), // ready from the start
    onStep({ world, weapon, owner, stunned, nearestOpponent, leadDirection }, s) {
      const ready = s.timer >= config.fireInterval
      const target = nearestOpponent()
      const facing = !!target
        && angleDiff(weapon.angle, Math.atan2(target.position.y - owner.position.y, target.position.x - owner.position.x)) <= cone
      if (!(ready && facing && target && !stunned)) {
        s.timer = Math.min(s.timer + 1, config.fireInterval)
        return
      }
      s.timer = 0
      // Aim at where the target WILL be (constant-velocity lead), so the
      // projectile actually flies at the opponent. Deterministic: positions only.
      const [dx, dy] = leadDirection(weapon.position, target, config.speed)
      world.add({
        id: world.allocateId(),
        kind: 'projectile',
        position: { x: weapon.position.x + dx * config.radius, y: weapon.position.y + dy * config.radius },
        velocity: { x: dx * config.speed, y: dy * config.speed },
        alive: true,
        radius: config.radius,
        damage: config.damage,
        ownerId: owner.id,
        blockable: !!config.blockable,
        weaponId: weapon.def.id,
      })
    },
    projectileResponse: () => 'pass',
  }
}
