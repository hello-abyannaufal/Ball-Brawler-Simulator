import type { Ball, Vec2, WeaponEntity } from '../entities'
import type { Hitbox } from './types'
import type { Rng } from '../rng'

/** Effective collision radius of a weapon hitbox for overlap tests. */
export function hitboxReach(hitbox: Hitbox): number {
  if (hitbox.shape === 'circle') return hitbox.radius
  // segment: approximate as a circle covering half its length plus thickness.
  return hitbox.length / 2 + hitbox.thickness / 2
}

/** True if a weapon's hitbox circle overlaps a ball. */
export function weaponHitsBall(weapon: WeaponEntity, ball: Ball): boolean {
  const reach = hitboxReach(weapon.hitbox)
  const dx = ball.position.x - weapon.position.x
  const dy = ball.position.y - weapon.position.y
  const sum = reach + ball.radius
  return dx * dx + dy * dy <= sum * sum
}

/** True if two weapon hitbox circles overlap. */
export function weaponsOverlap(a: WeaponEntity, b: WeaponEntity): boolean {
  const sum = hitboxReach(a.hitbox) + hitboxReach(b.hitbox)
  const dx = b.position.x - a.position.x
  const dy = b.position.y - a.position.y
  return dx * dx + dy * dy <= sum * sum
}

export type ClashOutcome = 'bounce' | 'parry' | 'disarm'

/**
 * Resolve a weapon clash to exactly one outcome, weighted by the two weapons'
 * `weight` values, using the deterministic RNG (Req 10.8, 10.12).
 *
 * The heavier weapon is favored: it tends to disarm the lighter one, the
 * lighter one tends to be bounced, and a parry occurs on a near-even match.
 * A weapon flagged `cannotBeParried` (Hammer) never yields a `parry`.
 */
export function resolveClash(
  a: WeaponEntity,
  b: WeaponEntity,
  rng: Rng,
): ClashOutcome {
  const wa = a.def.weight
  const wb = b.def.weight
  const total = wa + wb

  // Roll in [0, 1). Compare against the heavier weapon's share.
  const roll = rng.next()
  const heavierShare = Math.max(wa, wb) / total

  const parryForbidden = a.def.cannotBeParried || b.def.cannotBeParried

  // Near-even weights (small gap) favor a parry, unless forbidden.
  const gap = Math.abs(wa - wb) / total
  if (!parryForbidden && gap < 0.1) {
    return 'parry'
  }

  // Otherwise, the heavier weapon's dominance decides disarm vs bounce.
  return roll < heavierShare ? 'disarm' : 'bounce'
}

/** Unit direction from `from` to `to`, or +x if coincident (deterministic). */
export function unitToward(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const mag = Math.sqrt(dx * dx + dy * dy)
  if (mag === 0) return { x: 1, y: 0 }
  return { x: dx / mag, y: dy / mag }
}
