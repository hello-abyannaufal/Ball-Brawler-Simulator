import type { Ball } from './entities'
import type { World } from './world'

export interface StatusEffect {
  readonly id: string
  remaining: number // whole timesteps >= 0 (Req 7.1)
  readonly tickInterval: number // whole timesteps >= 1 (Req 7.1)
  sinceLastTick: number // whole timesteps
  onTick(ball: Ball, world: World): void // per-tick behavior
}

/**
 * Step operation 6: advance every ball's status effects (Req 7.2–7.4).
 * For each effect, per step:
 *   - decrement `remaining` by one (Req 7.2),
 *   - increment `sinceLastTick`; when it reaches `tickInterval`, fire `onTick`
 *     once and reset the counter (Req 7.3),
 *   - remove the effect once `remaining` reaches zero (Req 7.4).
 */
export function runStatusEffects(world: World): void {
  for (const ball of world.aliveBalls()) {
    const kept: StatusEffect[] = []
    for (const effect of ball.statusEffects) {
      effect.remaining -= 1 // Req 7.2
      effect.sinceLastTick += 1

      if (effect.sinceLastTick >= effect.tickInterval) {
        effect.sinceLastTick = 0
        effect.onTick(ball, world) // Req 7.3
      }

      if (effect.remaining > 0) {
        kept.push(effect)
      }
      // else: duration elapsed, drop it (Req 7.4)
    }
    ball.statusEffects = kept
  }
}
