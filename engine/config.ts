import type { Vec2 } from './entities'

export interface SkillRef {
  skillId: string
  config?: Record<string, number>
}

export interface WeaponRef {
  weaponId: string
}

export interface BallConfig {
  id: string
  radius: number
  maxHp: number
  contactDamage: number // may be 0
  initialPosition: Vec2
  initialVelocity: Vec2
  skills: SkillRef[] // resolved against SkillRegistry (Req 9.5)
  weapons: WeaponRef[] // resolved against WeaponRegistry
}

export interface ArenaConfig {
  width: number
  height: number
}

export interface DuelConfig {
  engineVersion: string // set to current engineVersion at save (Req 13.9)
  seed: number // 32-bit uint
  ballConfigs: BallConfig[]
  arenaConfig: ArenaConfig
}
