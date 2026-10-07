import type { Ball, EntityId } from '../entities'
import type { World } from '../world'
import type { DamageSource } from '../damage'

export interface SkillContext {
  ball: Ball
  world: World
  /** Resolved instance config (definition defaults merged with ref overrides). */
  config: Record<string, number>
  source?: DamageSource // readable on damage-driven hooks (Req 9.3)
  dealt?: { targetId: EntityId; amount: number }
  taken?: { attackerId: EntityId | ''; amount: number }
  /** Mutable per-instance state (e.g. Blaster firing timer). */
  state: Record<string, number>
}

/** Only these five hooks exist (Req 9.2). */
export interface SkillDefinition {
  readonly id: string // unique non-empty (Req 9.1)
  readonly config: Readonly<Record<string, number>>
  onTick?(ctx: SkillContext): void
  onHit?(ctx: SkillContext): void // this ball dealt damage
  onHurt?(ctx: SkillContext): void // this ball took damage
  onWallBounce?(ctx: SkillContext): void
  onDeath?(ctx: SkillContext): void
}

export interface SkillInstance {
  readonly def: SkillDefinition
  config: Record<string, number> // instance overrides
  state: Record<string, number> // e.g. firing timer for Blaster
}
