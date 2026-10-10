import type { Ball, EntityId } from './entities'
import type { World } from './world'
import { applyDamage } from './damage'

/** Ball stats a status may modify. Each has a base value (race) on `Ball.base`. */
export type ModifiableStat = 'cruiseSpeed' | 'damageTaken' | 'weaponSpin'

/** `add` values are summed first, then every `mul` multiplies the result. */
export interface StatModifier {
  readonly stat: ModifiableStat
  readonly op: 'add' | 'mul'
  readonly value: number // applied once per stack
}

/** Control effects: checked by the engine, not expressed as stat changes. */
export type ControlTag = 'stun' // stun: weapons stop spinning, hitting and firing

export interface StatusContext {
  world: World
  ball: Ball
  status: StatusInstance
}

/**
 * Static, data-driven definition of a status (one per id, in the registry).
 * Buffs and debuffs share this shape; `polarity` only labels the direction.
 */
export interface StatusDefinition {
  readonly id: string
  readonly polarity: 'buff' | 'debuff'
  readonly duration: number // whole timesteps >= 1
  /** refresh: reset duration. stack: reset duration and add a stack (up to
   *  maxStacks). ignore: a re-apply while active does nothing. */
  readonly stacking: 'refresh' | 'stack' | 'ignore'
  readonly maxStacks?: number // stacking 'stack' only (default 1)
  readonly modifiers?: readonly StatModifier[]
  readonly controls?: readonly ControlTag[]
  readonly tickInterval?: number // whole timesteps >= 1; required with onTick
  onTick?(ctx: StatusContext): void
}

/** Runtime state of one status on one ball. */
export interface StatusInstance {
  readonly defId: string
  remaining: number // whole timesteps >= 0
  stacks: number
  sourceId: EntityId | '' // credited attacker (e.g. for damage over time)
  sinceLastTick: number // whole timesteps
  appliedTick: number // world.tick it was (re)applied; skips that step's countdown
}

// ── Definitions ──────────────────────────────────────────────────────────────

/** Stat modifier: slower movement and weapon spin. */
const slow: StatusDefinition = {
  id: 'slow',
  polarity: 'debuff',
  duration: 120, // 2s
  stacking: 'refresh',
  modifiers: [
    { stat: 'cruiseSpeed', op: 'mul', value: 0.6 },
    { stat: 'weaponSpin', op: 'mul', value: 0.7 },
  ],
}

/** Damage over time: stacks intensify the damage per tick. */
const poison: StatusDefinition = {
  id: 'poison',
  polarity: 'debuff',
  duration: 180, // 3s
  stacking: 'stack',
  maxStacks: 3,
  tickInterval: 30, // every 0.5s
  onTick({ world, ball, status }) {
    applyDamage(world, {
      source: { tag: 'dot' },
      attackerId: status.sourceId,
      targetId: ball.id,
      amount: 2 * status.stacks,
    })
  },
}

/** Control: the ball's weapons go limp. */
const stun: StatusDefinition = {
  id: 'stun',
  polarity: 'debuff',
  duration: 45, // 0.75s
  stacking: 'refresh',
  controls: ['stun'],
}

export const statusRegistry: ReadonlyMap<string, StatusDefinition> = new Map(
  [slow, poison, stun].map((d) => [d.id, d]),
)

// ── Operations ───────────────────────────────────────────────────────────────

/**
 * The ONLY way to put a status on a ball (weapons, traits and abilities all go
 * through here). Applies the definition's stacking rule and emits
 * `statusApplied` when the status is added or changed.
 */
export function applyStatus(world: World, targetId: EntityId, defId: string, sourceId: EntityId | ''): void {
  const def = statusRegistry.get(defId)
  if (!def) throw new Error(`Unknown status id: ${defId}.`)
  const ball = world.ballById(targetId)
  if (!ball || !ball.alive) return

  const existing = ball.statusEffects.find((s) => s.defId === defId)
  if (existing) {
    if (def.stacking === 'ignore') return
    if (def.stacking === 'stack') existing.stacks = Math.min(existing.stacks + 1, def.maxStacks ?? 1)
    existing.remaining = def.duration
    existing.sourceId = sourceId
    existing.appliedTick = world.tick
  } else {
    ball.statusEffects.push({
      defId,
      remaining: def.duration,
      stacks: 1,
      sourceId,
      sinceLastTick: 0,
      appliedTick: world.tick,
    })
  }
  const stacks = existing?.stacks ?? 1
  world.emit({ type: 'statusApplied', ballId: ball.id, statusId: defId, sourceId, stacks })
}

/** True while any active status on `ball` carries the control tag. */
export function hasControl(ball: Ball, tag: ControlTag): boolean {
  return ball.statusEffects.some((s) => statusRegistry.get(s.defId)?.controls?.includes(tag))
}

/**
 * Rebuild every living ball's effective stats from its base stats and active
 * modifiers. Run at the start of each step so the whole step sees one
 * consistent value; with no statuses, effective equals base.
 */
export function recomputeStats(world: World): void {
  for (const ball of world.aliveBalls()) {
    const add: Record<ModifiableStat, number> = { cruiseSpeed: 0, damageTaken: 0, weaponSpin: 0 }
    const mul: Record<ModifiableStat, number> = { cruiseSpeed: 1, damageTaken: 1, weaponSpin: 1 }
    for (const s of ball.statusEffects) {
      for (const m of statusRegistry.get(s.defId)?.modifiers ?? []) {
        if (m.op === 'add') add[m.stat] += m.value * s.stacks
        else mul[m.stat] *= m.value ** s.stacks
      }
    }
    ball.cruiseSpeed = (ball.base.cruiseSpeed + add.cruiseSpeed) * mul.cruiseSpeed
    ball.damageTaken = (ball.base.damageTaken + add.damageTaken) * mul.damageTaken
    ball.weaponSpin = (ball.base.weaponSpin + add.weaponSpin) * mul.weaponSpin
  }
}

/**
 * Step operation 6: advance every ball's status effects (Req 7.2–7.4).
 * For each effect, per step:
 *   - skip a status (re)applied this very step, so a duration of N lasts N steps,
 *   - decrement `remaining` by one (Req 7.2),
 *   - increment `sinceLastTick`; when it reaches `tickInterval`, fire `onTick`
 *     once and reset the counter (Req 7.3),
 *   - remove the effect once `remaining` reaches zero (Req 7.4), emitting
 *     `statusExpired`.
 */
export function runStatusEffects(world: World): void {
  for (const ball of world.aliveBalls()) {
    const kept: StatusInstance[] = []
    for (const status of ball.statusEffects) {
      if (status.appliedTick === world.tick) {
        kept.push(status)
        continue
      }
      const def = statusRegistry.get(status.defId)!
      status.remaining -= 1 // Req 7.2
      status.sinceLastTick += 1

      if (def.onTick && status.sinceLastTick >= (def.tickInterval ?? 1)) {
        status.sinceLastTick = 0
        def.onTick({ world, ball, status }) // Req 7.3
      }

      if (status.remaining > 0) {
        kept.push(status)
      } else {
        world.emit({ type: 'statusExpired', ballId: ball.id, statusId: status.defId }) // Req 7.4
      }
    }
    ball.statusEffects = kept
  }
}
