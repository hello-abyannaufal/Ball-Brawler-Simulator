import type { Ball } from './entities'
import type { World } from './world'

export interface StatusEffect {
  readonly id: string
  remaining: number // whole timesteps >= 0 (Req 7.1)
  readonly tickInterval: number // whole timesteps >= 1 (Req 7.1)
  sinceLastTick: number // whole timesteps
  onTick(ball: Ball, world: World): void // per-tick behavior
}

// runStatusEffects is implemented in task 9.1.
