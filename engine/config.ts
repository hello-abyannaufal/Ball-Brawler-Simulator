import type { Vec2 } from './entities'

export interface SkillRef {
  skillId: string
  config?: Record<string, number>
}

export interface WeaponRef {
  weaponId: string
}

/**
 * How a ball is painted by the renderer (visual-only; the engine ignores it,
 * so determinism is unaffected). The renderer clips a circle and fills it per
 * this value. Defaults to a solid color when absent.
 */
export type BallAppearance =
  | { type: 'color'; value: string }
  | { type: 'pattern'; patternId: string }
  | { type: 'image'; src: string }

export interface BallConfig {
  id: string
  radius: number
  maxHp: number
  contactDamage: number // may be 0
  initialPosition: Vec2
  initialVelocity: Vec2
  skills: SkillRef[] // resolved against SkillRegistry (Req 9.5)
  weapons: WeaponRef[] // resolved against WeaponRegistry
  appearance?: BallAppearance // visual-only, renderer concern
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
