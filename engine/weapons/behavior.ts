import type { Ball, EntityId, Vec2, WeaponEntity } from '../entities'
import type { World } from '../world'

/**
 * What the engine hands a behavior hook: the weapon, its owner, and the engine
 * primitives a behavior may use. A behavior only ever touches its own weapon
 * and state; other weapons reach it through generic engine concepts (a clash
 * it won or lost, a projectile touching it), never by their definitions.
 */
export interface BehaviorContext {
  readonly world: World
  readonly weapon: WeaponEntity
  readonly owner: Ball
  /** Owner is stunned (status): the weapon holds still and must not act. */
  readonly stunned: boolean
  /** The weapon's normal hit cooldown, in steps. */
  readonly fullCooldownSteps: number
  nearestOpponent(): Ball | undefined
  /** Unit direction from `from` that intercepts `target` at `speed`. */
  leadDirection(from: Vec2, target: Ball, speed: number): [number, number]
  /** Keep this weapon from hitting `targetId` for `steps`. */
  startCooldown(targetId: EntityId, steps: number): void
}

/** How a landed hit plays out; `afterHit` hooks adjust it, then the engine applies it. */
export interface HitResponse {
  cooldownSteps: number // starts at the weapon's full hit cooldown
  knockback: 'push' | 'none' | { launchSpeed: number } // push: the base knockback impulse
  /** If the struck ball hits a wall within `windowSteps`, it takes `damage` once more. */
  wallSlam?: { damage: number; windowSteps: number }
}

/**
 * A reusable piece of weapon behavior (riposte, reap, shooting, …). A weapon
 * is its base stats plus a list of these. Every hook is optional; the engine
 * calls them in list order, so the result stays deterministic. `S` is the
 * per-weapon runtime state, created by `init` for each weapon entity.
 */
export interface WeaponBehavior<S = unknown> {
  readonly id: string
  init(): S
  /** × the weapon's spin this step (all behaviors multiply). */
  spinMultiplier?(state: S): number
  /** Once per step, after the weapon moved. */
  onStep?(ctx: BehaviorContext, state: S): void
  /** After a clash; `won`: the weapon wasn't the one disarmed. */
  onClash?(ctx: BehaviorContext, state: S, won: boolean): void
  /** × the damage of a hit about to land on `target` (all behaviors multiply). */
  hitMultiplier?(ctx: BehaviorContext, state: S, target: Ball): number
  /** After a hit landed on `target`: adjust how it plays out. */
  afterHit?(ctx: BehaviorContext, state: S, target: Ball, hit: HitResponse): void
  /** An opposing projectile touches the weapon. undefined: no opinion (the
   *  first behavior with one decides; with none, the weapon blocks it). */
  projectileResponse?(state: S): 'reflect' | 'pass' | undefined
  /** Render-only: a burst is running (the renderer draws a trail). */
  active?(state: S): boolean
}

/** Fresh runtime state for each of a definition's behaviors. */
export function initBehaviorState(behaviors: readonly WeaponBehavior[] | undefined): unknown[] {
  return (behaviors ?? []).map((b) => b.init())
}

/** Id of the weapon's first behavior with a burst running, or undefined (render-only). */
export function activeBehaviorId(w: WeaponEntity): string | undefined {
  return w.def.behaviors?.find((b, i) => b.active?.(w.behaviorState[i]))?.id
}

/** Does the definition use a behavior with this id? */
export function hasBehavior(w: WeaponEntity, id: string): boolean {
  return !!w.def.behaviors?.some((b) => b.id === id)
}

/** Reject a behavior config value with a readable message. */
export function invalid(field: string, why: string): never {
  throw new Error(`Invalid weapon behavior: ${field} ${why}.`)
}
