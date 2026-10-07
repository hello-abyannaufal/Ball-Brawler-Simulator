import type { Ball } from './entities'
import type { ArenaConfig } from './config'

/**
 * Circle-vs-wall resolution (Req 8.2).
 * For each wall the ball has reached or crossed: negate the normal velocity
 * component and reposition so the ball edge is tangent, keeping the whole ball
 * inside the arena. Returns true if any wall bounce occurred.
 */
export function resolveWallCollision(ball: Ball, arena: ArenaConfig): boolean {
  let bounced = false
  const r = ball.radius

  // Left / right walls (x normal).
  if (ball.position.x - r <= 0) {
    ball.position.x = r
    ball.velocity.x = -ball.velocity.x
    bounced = true
  } else if (ball.position.x + r >= arena.width) {
    ball.position.x = arena.width - r
    ball.velocity.x = -ball.velocity.x
    bounced = true
  }

  // Top / bottom walls (y normal).
  if (ball.position.y - r <= 0) {
    ball.position.y = r
    ball.velocity.y = -ball.velocity.y
    bounced = true
  } else if (ball.position.y + r >= arena.height) {
    ball.position.y = arena.height - r
    ball.velocity.y = -ball.velocity.y
    bounced = true
  }

  return bounced
}

/** Circle-vs-circle overlap test (Req 8.4). */
export function ballsOverlap(a: Ball, b: Ball): boolean {
  const dx = b.position.x - a.position.x
  const dy = b.position.y - a.position.y
  const sumR = a.radius + b.radius
  return dx * dx + dy * dy <= sumR * sumR
}

/**
 * Push two overlapping balls apart along the center line until their center
 * distance equals the sum of their radii, i.e. tangent (Req 8.4).
 * Each ball moves half of the overlap. Degenerate (coincident) centers are
 * separated along a fixed axis so the result stays deterministic.
 */
export function separateBalls(a: Ball, b: Ball): void {
  let dx = b.position.x - a.position.x
  let dy = b.position.y - a.position.y
  let dist = Math.sqrt(dx * dx + dy * dy)
  const sumR = a.radius + b.radius

  if (dist === 0) {
    // Coincident centers: pick a deterministic axis (x).
    dx = 1
    dy = 0
    dist = 1
  }

  const overlap = sumR - dist
  if (overlap <= 0) return

  const nx = dx / dist
  const ny = dy / dist
  const half = overlap / 2

  a.position.x -= nx * half
  a.position.y -= ny * half
  b.position.x += nx * half
  b.position.y += ny * half
}

/**
 * Elastic bounce between two balls along their center line. Reflects the
 * velocity components that point INTO the collision so the balls separate
 * instead of sticking. Equal-mass, fully elastic (swap of normal components).
 * Tangential motion is preserved. Does nothing if they are already moving
 * apart.
 */
export function bounceBalls(a: Ball, b: Ball): void {
  let nx = b.position.x - a.position.x
  let ny = b.position.y - a.position.y
  let dist = Math.sqrt(nx * nx + ny * ny)
  if (dist === 0) {
    nx = 1
    ny = 0
    dist = 1
  }
  nx /= dist
  ny /= dist

  // Relative velocity along the normal (a → b).
  const rvx = b.velocity.x - a.velocity.x
  const rvy = b.velocity.y - a.velocity.y
  const velAlongNormal = rvx * nx + rvy * ny

  // Already separating: nothing to do.
  if (velAlongNormal > 0) return

  // Equal mass fully elastic: exchange the normal components.
  const impulse = velAlongNormal // negative
  a.velocity.x += impulse * nx
  a.velocity.y += impulse * ny
  b.velocity.x -= impulse * nx
  b.velocity.y -= impulse * ny
}

/**
 * Apply a knockback impulse to `struck`, directed along the line from the
 * striker's center to the struck ball's center (Req 8.6).
 */
export function applyKnockback(
  striker: Ball,
  struck: Ball,
  magnitude: number,
): void {
  let dx = struck.position.x - striker.position.x
  let dy = struck.position.y - striker.position.y
  let dist = Math.sqrt(dx * dx + dy * dy)

  if (dist === 0) {
    dx = 1
    dy = 0
    dist = 1
  }

  struck.velocity.x += (dx / dist) * magnitude
  struck.velocity.y += (dy / dist) * magnitude
}
