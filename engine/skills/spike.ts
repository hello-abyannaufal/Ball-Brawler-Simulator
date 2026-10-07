import type { SkillDefinition } from './types'
import { skillRegistry } from './registry'
import { applyDamage } from '../damage'

/**
 * Spike (Req 9.7): when this ball takes `contact` damage, reflect
 * `reflectAmount` back to the attacker via applyDamage with `isReflected` set,
 * so the reflection cannot itself reflect again.
 */
export const spike: SkillDefinition = {
  id: 'spike',
  iconId: 'icon:skill:spike',
  config: { reflectAmount: 2 },
  onHurt(ctx) {
    if (ctx.source?.tag !== 'contact') return
    const attackerId = ctx.taken?.attackerId
    if (attackerId === undefined || attackerId === '') return

    applyDamage(ctx.world, {
      source: { tag: 'reflect' },
      attackerId: ctx.ball.id,
      targetId: attackerId,
      amount: ctx.config.reflectAmount!,
      flags: { isReflected: true },
    })
  },
}

skillRegistry.register(spike)
