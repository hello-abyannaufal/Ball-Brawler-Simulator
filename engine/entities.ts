import type { WeaponInstance, WeaponDefinition, Hitbox  } from './weapons/types'
import type { StatusEffect } from './status'

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
  cruiseSpeed: number // speed the ball eases back to after knockback
  weapons: WeaponInstance[]
  statusEffects: StatusEffect[]
}

export interface Projectile extends BaseEntity {
  kind: 'projectile'
  radius: number
  damage: number
  ownerId: EntityId // credited attacker
}

export interface WeaponEntity extends BaseEntity {
  kind: 'weapon'
  ownerId: EntityId
  def: WeaponDefinition
  angle: number // orbit/orientation
  angularSpeed: number // runtime spin speed; starts from def, flips on clash
  stunSteps: number // >0 after being disarmed: no damage until it reaches 0
  hitbox: Hitbox // resolved world-space hitbox this step
}

export type Entity = Ball | Projectile | WeaponEntity
