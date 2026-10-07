import type { EntityId } from './entities'
import type { DamageSource } from './damage'

export type EngineEvent =
  | {
      type: 'damage'
      source: DamageSource
      attackerId: EntityId | ''
      targetId: EntityId
      amount: number
    }
  | {
      type: 'weaponClash'
      a: EntityId
      b: EntityId
      outcome: 'bounce' | 'parry' | 'disarm'
    }
  | { type: 'ballDied'; ballId: EntityId }
  | { type: 'matchEnded'; winner: EntityId | null }
