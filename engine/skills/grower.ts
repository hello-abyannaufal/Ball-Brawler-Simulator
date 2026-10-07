import type { SkillDefinition } from './types'
import { skillRegistry } from './registry'

/**
 * Grower (Req 9.10): on each wall bounce, increase radius by `radiusGain` and
 * speed by `speedGain` (scaling the velocity vector's magnitude).
 */
export const grower: SkillDefinition = {
  id: 'grower',
  iconId: 'icon:skill:grower',
  config: { radiusGain: 1, speedGain: 10 },
  onWallBounce(ctx) {
    const { ball } = ctx
    ball.radius += ctx.config.radiusGain!

    const vx = ball.velocity.x
    const vy = ball.velocity.y
    const mag = Math.sqrt(vx * vx + vy * vy)
    const speedGain = ctx.config.speedGain!
    ball.cruiseSpeed += speedGain
    if (mag === 0) return
    const newMag = mag + speedGain
    ball.velocity.x = (vx / mag) * newMag
    ball.velocity.y = (vy / mag) * newMag
  },
}

skillRegistry.register(grower)
