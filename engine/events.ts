import type { EntityId } from './entities'
import type { DamageSource } from './damage'

export type EngineEvent =
  | {
      type: 'damage'
      source: DamageSource
      attackerId: EntityId | ''
      targetId: EntityId
      amount: number
      style?: 'critical' // presentation hint (see DamageFlags.style)
    }
  | {
      type: 'weaponClash'
      a: EntityId
      b: EntityId
      outcome: 'bounce' | 'parry' | 'disarm'
    }
  | { type: 'ballDied'; ballId: EntityId }
  /** A riposting blade sent a projectile back at its shooter from (x, y). */
  | { type: 'projectileReflected'; projectileId: EntityId; weaponId: EntityId; x: number; y: number }
  /** An arrow was swatted out of the air by a weapon at (x, y). */
  | { type: 'projectileBlocked'; projectileId: EntityId; weaponId: EntityId; x: number; y: number }
  /** A slammed ball hit a wall at (x, y); a `damage` event follows. */
  | { type: 'wallSlam'; ballId: EntityId; attackerId: EntityId; x: number; y: number }
  /** A status was added to a ball, or re-applied (refreshed / stacked). */
  | { type: 'statusApplied'; ballId: EntityId; statusId: string; sourceId: EntityId | ''; stacks: number }
  /** A status ran out on a ball. */
  | { type: 'statusExpired'; ballId: EntityId; statusId: string }
  | { type: 'matchEnded'; winner: EntityId | null }
