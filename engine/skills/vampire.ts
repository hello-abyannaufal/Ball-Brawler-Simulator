import type { SkillDefinition } from './types'
import { skillRegistry } from './registry'

/**
 * Vampire (Req 9.6): on dealing damage, heal by `healFraction` × damage dealt,
 * clamped so HP never exceeds maxHp.
 */
export const vampire: SkillDefinition = {
  id: 'vampire',
  config: { healFraction: 0.3 },
  onHit(ctx) {
    const dealt = ctx.dealt?.amount ?? 0
    if (dealt <= 0) return
    const heal = dealt * ctx.config.healFraction!
    ctx.ball.hp = Math.min(ctx.ball.maxHp, ctx.ball.hp + heal)
  },
}

skillRegistry.register(vampire)
