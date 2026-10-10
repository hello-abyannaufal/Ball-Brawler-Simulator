import type { Ball, Vec2, WeaponEntity } from '../entities'
import type { Rng } from '../rng'

type Segment = { ax: number; ay: number; bx: number; by: number }

/**
 * World-space segment of a segment hitbox: centered on the weapon position and
 * laid along its angle (spans ball surface -> blade tip).
 */
function bladeSegment(w: WeaponEntity, length: number): Segment {
  const hx = (Math.cos(w.angle) * length) / 2
  const hy = (Math.sin(w.angle) * length) / 2
  return {
    ax: w.position.x - hx,
    ay: w.position.y - hy,
    bx: w.position.x + hx,
    by: w.position.y + hy,
  }
}

/** Squared distance from point (px, py) to a segment. */
function pointSegDistSq(px: number, py: number, s: Segment): number {
  const dx = s.bx - s.ax
  const dy = s.by - s.ay
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - s.ax) * dx + (py - s.ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = s.ax + dx * t - px
  const cy = s.ay + dy * t - py
  return cx * cx + cy * cy
}

/** Squared distance between two segments (0 when they cross). */
function segSegDistSq(p: Segment, q: Segment): number {
  const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx
  const d1 = cross(q.bx - q.ax, q.by - q.ay, p.ax - q.ax, p.ay - q.ay)
  const d2 = cross(q.bx - q.ax, q.by - q.ay, p.bx - q.ax, p.by - q.ay)
  const d3 = cross(p.bx - p.ax, p.by - p.ay, q.ax - p.ax, q.ay - p.ay)
  const d4 = cross(p.bx - p.ax, p.by - p.ay, q.bx - p.ax, q.by - p.ay)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return 0
  }
  return Math.min(
    pointSegDistSq(p.ax, p.ay, q),
    pointSegDistSq(p.bx, p.by, q),
    pointSegDistSq(q.ax, q.ay, p),
    pointSegDistSq(q.bx, q.by, p),
  )
}

/**
 * Squared distance from a point to a weapon's hitbox core (segment axis or
 * circle center), plus the hitbox's own half-width / radius.
 */
function distToHitbox(w: WeaponEntity, px: number, py: number): { distSq: number; pad: number } {
  const h = w.hitbox
  if (h.shape === 'circle') {
    const dx = px - w.position.x
    const dy = py - w.position.y
    return { distSq: dx * dx + dy * dy, pad: h.radius }
  }
  return { distSq: pointSegDistSq(px, py, bladeSegment(w, h.length)), pad: h.thickness / 2 }
}

/** True if a weapon's actual hitbox shape overlaps a ball. */
export function weaponHitsBall(weapon: WeaponEntity, ball: Ball): boolean {
  const { distSq, pad } = distToHitbox(weapon, ball.position.x, ball.position.y)
  const sum = pad + ball.radius
  return distSq <= sum * sum
}

/**
 * Where along a segment blade a ball's center projects: 0 = grip (ball
 * surface), 1 = tip. Circles have no length and return 1.
 */
export function bladeHitFraction(w: WeaponEntity, ball: Ball): number {
  if (w.hitbox.shape !== 'segment') return 1
  const ux = Math.cos(w.angle)
  const uy = Math.sin(w.angle)
  const half = w.hitbox.length / 2
  const along = (ball.position.x - w.position.x) * ux + (ball.position.y - w.position.y) * uy
  return Math.max(0, Math.min(1, (along + half) / w.hitbox.length))
}

/**
 * True if a circle of radius `r` moving from (x0, y0) to (x1, y1) touched the
 * weapon's hitbox anywhere along the way (swept, so a fast projectile can't
 * skip over a thin blade between steps). The weapon is taken at its current pose.
 */
export function weaponTouchesPath(w: WeaponEntity, x0: number, y0: number, x1: number, y1: number, r: number): boolean {
  const path: Segment = { ax: x0, ay: y0, bx: x1, by: y1 }
  const h = w.hitbox
  const sum = r + (h.shape === 'circle' ? h.radius : h.thickness / 2)
  const distSq = h.shape === 'circle'
    ? pointSegDistSq(w.position.x, w.position.y, path)
    : segSegDistSq(path, bladeSegment(w, h.length))
  return distSq <= sum * sum
}

/** True if two weapon hitboxes (segment/circle, any mix) overlap. */
export function weaponsOverlap(a: WeaponEntity, b: WeaponEntity): boolean {
  const ha = a.hitbox
  const hb = b.hitbox
  if (ha.shape === 'segment' && hb.shape === 'segment') {
    const sum = (ha.thickness + hb.thickness) / 2
    return segSegDistSq(bladeSegment(a, ha.length), bladeSegment(b, hb.length)) <= sum * sum
  }
  // At least one circle: measure from the circle's center to the other shape.
  const [circle, other] = ha.shape === 'circle' ? [a, b] : [b, a]
  const r = (circle.hitbox as { radius: number }).radius
  const { distSq, pad } = distToHitbox(other, circle.position.x, circle.position.y)
  const sum = r + pad
  return distSq <= sum * sum
}

export type ClashOutcome = 'bounce' | 'parry' | 'disarm'

/** Cap on the disarm chance, however lopsided the weights: the heavier weapon
 *  is still favored, but a much lighter one isn't near-certain to lose. */
export const MAX_DISARM_CHANCE = 0.6

/**
 * Resolve a weapon clash to exactly one outcome, weighted by the two weapons'
 * `weight` values, using the deterministic RNG (Req 10.8, 10.12).
 *
 * The heavier weapon is favored (disarm chance = its weight share, capped at
 * MAX_DISARM_CHANCE): it tends to disarm the lighter one, the
 * lighter one tends to be bounced, and a parry occurs on a near-even match.
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

  // Near-even weights (small gap) favor a parry.
  const gap = Math.abs(wa - wb) / total
  if (gap < 0.1) {
    return 'parry'
  }

  // Otherwise, the heavier weapon's dominance decides disarm vs bounce,
  // capped so weight alone can't decide every exchange.
  return roll < Math.min(heavierShare, MAX_DISARM_CHANCE) ? 'disarm' : 'bounce'
}

/** Unit direction from `from` to `to`, or +x if coincident (deterministic). */
export function unitToward(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const mag = Math.sqrt(dx * dx + dy * dy)
  if (mag === 0) return { x: 1, y: 0 }
  return { x: dx / mag, y: dy / mag }
}
