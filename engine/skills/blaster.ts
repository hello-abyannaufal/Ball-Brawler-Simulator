import type { SkillDefinition } from './types'
import type { Projectile } from '../entities'
import { skillRegistry } from './registry'

/**
 * Blaster (Req 9.8): every `fireInterval` steps during onTick, spawn one
 * projectile entity credited to this ball, launched along the ball's heading.
 */
export const blaster: SkillDefinition = {
  id: 'blaster',
  iconId: 'icon:skill:blaster',
  config: {
    fireInterval: 60,
    projectileSpeed: 120,
    projectileRadius: 3,
    projectileDamage: 4,
  },
  onTick(ctx) {
    const interval = ctx.config.fireInterval!
    ctx.state.sinceFire = (ctx.state.sinceFire ?? 0) + 1
    if (ctx.state.sinceFire < interval) return
    ctx.state.sinceFire = 0

    const { ball, world } = ctx
    // Heading: ball velocity direction, or +x if stationary (deterministic).
    let dx = ball.velocity.x
    let dy = ball.velocity.y
    const mag = Math.sqrt(dx * dx + dy * dy)
    if (mag === 0) {
      dx = 1
      dy = 0
    } else {
      dx /= mag
      dy /= mag
    }

    const speed = ctx.config.projectileSpeed!
    const radius = ctx.config.projectileRadius!
    const projectile: Projectile = {
      id: world.allocateId(),
      kind: 'projectile',
      // Spawn just outside the ball's edge along the heading.
      position: {
        x: ball.position.x + dx * (ball.radius + radius),
        y: ball.position.y + dy * (ball.radius + radius),
      },
      velocity: { x: dx * speed, y: dy * speed },
      alive: true,
      radius,
      damage: ctx.config.projectileDamage!,
      ownerId: ball.id, // credited attacker (Req 9.8)
    }
    world.add(projectile)
  },
}

skillRegistry.register(blaster)
