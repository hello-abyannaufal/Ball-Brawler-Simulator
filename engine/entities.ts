import type { WeaponInstance, WeaponDefinition, Hitbox  } from './weapons/types'
import type { ModifiableStat, StatusInstance } from './status'

export type EntityId = number // monotonically increasing, stable order

export type EntityKind = 'ball' | 'projectile' | 'weapon'

export interface Vec2 {
  x: number
  y: number
}

export interface BaseEntity {
  readonly id: EntityId
  kind: EntityKind
  position: Vec2
  velocity: Vec2
  alive: boolean
}

export interface Ball extends BaseEntity {
  kind: 'ball'
  radius: number
  hp: number
  maxHp: number
  /** Unmodified stats (race). The effective fields below are rebuilt from
   *  these and active status modifiers every step (`recomputeStats`). */
  readonly base: Readonly<Record<ModifiableStat, number>>
  cruiseSpeed: number // speed the ball eases back to after knockback
  damageTaken: number // × every incoming damage amount (race)
  weaponSpin: number // × the spin speed of every carried weapon (race)
  /** Pending wall-slam from a heavy hit (e.g. Hammer); null when none. */
  slam: { attackerId: EntityId; damage: number; steps: number } | null
  weapons: WeaponInstance[]
  statusEffects: StatusInstance[]
}

export interface Projectile extends BaseEntity {
  kind: 'projectile'
  radius: number
  damage: number
  ownerId: EntityId // credited attacker
  blockable: boolean // can be swatted out of the air by an opposing weapon
  weaponId: string // definition id of the weapon that made it (renderer picks the sprite)
  orbiting: boolean // summoned and circling its owner, not thrown yet
  orbitSlot: number // fixed ring slot while circling (0..maxStack-1); -1 otherwise
  bounceSteps: number // > 0: reflects off walls instead of leaving the arena; counts down
}

export interface WeaponEntity extends BaseEntity {
  kind: 'weapon'
  ownerId: EntityId
  def: WeaponDefinition
  angle: number // orbit/orientation
  angularSpeed: number // runtime spin speed; starts from def, flips on clash
  stunSteps: number // >0 after being disarmed: no damage until it reaches 0
  riposteSteps: number // >0 while a riposte (boosted next hit) is ready
  reapSteps: number // >0 while a reap (fast spin, rapid re-hits) is running
  hitbox: Hitbox // resolved world-space hitbox this step
}

export type Entity = Ball | Projectile | WeaponEntity
