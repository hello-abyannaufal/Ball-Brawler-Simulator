import type { SkillDefinition } from './types'
import type { Ball } from '../entities'
import { skillRegistry } from './registry'

/**
 * Splitter (Req 9.9): on death, spawn `splitCount` smaller balls, each at
 * `radiusFactor` of this ball's radius. Child headings are spread evenly around
 * a circle so the result is deterministic.
 */
export const splitter: SkillDefinition = {
  id: 'splitter',
  config: {
    splitCount: 2,
    radiusFactor: 0.5,
    childHp: 5,
    childSpeed: 60,
  },
  onDeath(ctx) {
    const { ball, world } = ctx
    const count = Math.max(0, Math.trunc(ctx.config.splitCount!))
    if (count === 0) return

    const childRadius = ball.radius * ctx.config.radiusFactor!
    const childHp = ctx.config.childHp!
    const speed = ctx.config.childSpeed!

    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count
      const dx = Math.cos(angle)
      const dy = Math.sin(angle)
      const child: Ball = {
        id: world.allocateId(),
        kind: 'ball',
        position: {
          x: ball.position.x + dx * (childRadius + 0.001),
          y: ball.position.y + dy * (childRadius + 0.001),
        },
        velocity: { x: dx * speed, y: dy * speed },
        alive: true,
        radius: childRadius,
        hp: childHp,
        maxHp: childHp,
        contactDamage: ball.contactDamage,
        skills: [], // children do not re-split (no inherited skills)
        weapons: [],
        statusEffects: [],
      }
      world.add(child)
    }
  },
}

skillRegistry.register(splitter)
