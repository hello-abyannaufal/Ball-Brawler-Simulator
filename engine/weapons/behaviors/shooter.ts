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
  /** Impulse pushed into the struck ball along the projectile's flight. */
  knockback?: number
  /** `size` shots, then `reloadSteps` before the magazine is full again.
   *  Without it the weapon never runs dry. */
  magazine?: { size: number; reloadSteps: number }
  /** While loaded and facing the target, the weapon stops spinning and keeps
   *  firing as long as the target stays within ±`holdDegrees`. */
  aimLock?: { holdDegrees: number }
  /** The weapon body blocks opposing projectiles like a blade would (by
   *  default projectiles pass straight through a shooter). */
  blocksProjectiles?: boolean
}

interface ShooterState {
  timer: number // steps since the last shot, capped at fireInterval
  ammo: number // shots left in the magazine (unused without one)
  reload: number // steps into the current reload
  locked: boolean // aim lock holding the weapon still
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
 * Shooter (Bow, Revolver): fires a projectile only while the weapon faces an
 * opponent AND the fire interval is ready (Req 10.10). Range does not matter.
 * Optionally runs dry and reloads (`magazine`) and holds its aim while firing
 * (`aimLock`). The weapon itself can't swat projectiles unless
 * `blocksProjectiles` is set.
 */
export function shooter(config: ProjectileSettings): WeaponBehavior<ShooterState> {
  if (!(config.speed > 0)) invalid('projectile.speed', 'must be > 0')
  if (!(config.radius > 0)) invalid('projectile.radius', 'must be > 0')
  if (!(config.damage >= 0)) invalid('projectile.damage', 'must be >= 0')
  if (!(config.fireInterval >= 1) || !Number.isInteger(config.fireInterval)) {
    invalid('projectile.fireInterval', 'must be an integer >= 1')
  }
  const { magazine, aimLock } = config
  if (magazine) {
    if (!(magazine.size >= 1) || !Number.isInteger(magazine.size)) invalid('magazine.size', 'must be an integer >= 1')
    if (!(magazine.reloadSteps >= 1) || !Number.isInteger(magazine.reloadSteps)) {
      invalid('magazine.reloadSteps', 'must be an integer >= 1')
    }
  }
  if (aimLock && !(aimLock.holdDegrees > 0)) invalid('aimLock.holdDegrees', 'must be > 0')
  const cone = ((config.facingDegrees ?? DEFAULT_FACING_DEGREES) * Math.PI) / 180
  const holdCone = aimLock ? (aimLock.holdDegrees * Math.PI) / 180 : cone
  return {
    id: 'shooter',
    // Ready and full from the start.
    init: () => ({ timer: config.fireInterval, ammo: magazine?.size ?? 0, reload: 0, locked: false }),
    ...(aimLock ? { spinMultiplier: (s: ShooterState) => (s.locked ? 0 : 1) } : {}),
    onStep({ world, weapon, owner, stunned, nearestOpponent, leadDirection }, s) {
      // An empty magazine refills after reloadSteps.
      if (magazine && s.ammo === 0 && ++s.reload >= magazine.reloadSteps) {
        s.ammo = magazine.size
        s.reload = 0
      }
      const loaded = !magazine || s.ammo > 0
      const ready = s.timer >= config.fireInterval
      const target = nearestOpponent()
      const off = target
        ? angleDiff(weapon.angle, Math.atan2(target.position.y - owner.position.y, target.position.x - owner.position.x))
        : Infinity
      // Aim lock: once on target, hold still (wider cone) until out of ammo or sight.
      if (aimLock) s.locked = loaded && !stunned && off <= (s.locked ? holdCone : cone)
      const facing = off <= (s.locked ? holdCone : cone)
      if (!(ready && facing && target && !stunned && loaded)) {
        s.timer = Math.min(s.timer + 1, config.fireInterval)
        return
      }
      s.timer = 0
      if (magazine) s.ammo -= 1
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
        knockback: config.knockback ?? 0,
      })
    },
    ...(config.blocksProjectiles ? {} : { projectileResponse: () => 'pass' as const }),
  }
}
