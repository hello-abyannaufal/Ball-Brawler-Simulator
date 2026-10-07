import type { EntityId } from './entities'

import type { World } from './world'

export type DamageSourceTag =
  // active in phases 3-5
  | 'weapon'
  | 'projectile'
  // reserved, unimplemented (Req 6.5)
  | 'area'
  | 'dot'
  | 'environment'
  | 'beam'
  | 'summon'
  | 'reflect'

/** All Damage_Source tags, active and reserved (Req 6.4, 6.5). */
export const DAMAGE_SOURCE_TAGS: readonly DamageSourceTag[] = [
  'weapon',
  'projectile',
  'area',
  'dot',
  'environment',
  'beam',
  'summon',
  'reflect',
]

export interface DamageSource {
  readonly tag: DamageSourceTag
}

export interface DamageFlags {
  readonly isReflected?: boolean // reflected damage cannot reflect again (Req 6.9)
  readonly summonOwnerId?: EntityId // when set, credits owner (Req 6.8)
  /** How the hit should feel; copied onto the damage event for the renderer.
   *  `critical`: a boosted hit (riposte, spear tip). */
  readonly style?: 'critical'
}

export interface ApplyDamageInput {
  source: DamageSource
  attackerId: EntityId | '' // empty allowed (Req 6.7)
  targetId: EntityId
  amount: number
  flags?: DamageFlags
}

export type ApplyDamageOutcome =
  | {
      kind: 'applied'
      applied: number
      killed: boolean
      creditedAttacker: EntityId | ''
    }
  | { kind: 'noop'; reason: 'non-positive-amount' }
  | { kind: 'target-not-found' }
  | { kind: 'invalid-source' }

const VALID_TAGS = new Set<DamageSourceTag>(DAMAGE_SOURCE_TAGS)

/**
 * The ONLY function that reduces Ball HP (Req 6.1).
 * - amount <= 0: no change, no event, noop (Req 6.2)
 * - target not a living ball: no change, target-not-found (Req 6.3)
 * - source tag not in the union: no change, invalid-source (Req 6.6)
 * - empty attackerId allowed (Req 6.7)
 * - summonOwnerId set: credited attacker = owner (Req 6.8)
 * - isReflected set: applies once, triggers no further reflection (Req 6.9)
 * - positive application: emits exactly one `damage` event (Req 6.10)
 * - HP reaches <= 0: clamps to 0, marks dead, emits exactly one `ballDied` (Req 6.11)
 */
export function applyDamage(
  world: World,
  input: ApplyDamageInput,
): ApplyDamageOutcome {
  // Invalid source tag (Req 6.6).
  if (!VALID_TAGS.has(input.source.tag)) {
    return { kind: 'invalid-source' }
  }

  // Non-positive amount (Req 6.2).
  if (!(input.amount > 0)) {
    return { kind: 'noop', reason: 'non-positive-amount' }
  }

  // Target must be a living ball (Req 6.3).
  const target = world.ballById(input.targetId)
  if (!target || !target.alive) {
    return { kind: 'target-not-found' }
  }

  // Credit the summon owner when present (Req 6.8), else the given attacker (Req 6.7).
  const creditedAttacker: EntityId | '' =
    input.flags?.summonOwnerId !== undefined
      ? input.flags.summonOwnerId
      : input.attackerId

  const before = target.hp
  const applied = Math.min(before, input.amount)
  target.hp = before - input.amount

  // Emit exactly one damage event for the positive application (Req 6.10).
  world.emit({
    type: 'damage',
    source: input.source,
    attackerId: creditedAttacker,
    targetId: target.id,
    amount: applied,
    ...(input.flags?.style ? { style: input.flags.style } : {}),
  })

  let killed = false
  if (target.hp <= 0) {
    target.hp = 0 // clamp, never negative (Req 6.11)
    target.alive = false
    killed = true
    world.emit({ type: 'ballDied', ballId: target.id })
  }

  return { kind: 'applied', applied, killed, creditedAttacker }
}
