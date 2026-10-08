import type { BallConfig } from '../config'
import type { RaceDefinition } from './types'

/**
 * Registry of race definitions. `register` validates every field, rejecting
 * invalid definitions with an error naming the offending field.
 */
export class RaceRegistry {
  private readonly defs = new Map<string, RaceDefinition>()

  register(def: RaceDefinition): void {
    this.validate(def)
    // Under dev HMR an edited definition module re-runs and re-registers its
    // id: replace it instead of throwing. Outside HMR duplicates still fail.
    if (this.defs.has(def.id) && !import.meta.hot) {
      throw new Error(`Duplicate race id: ${def.id}.`)
    }
    this.defs.set(def.id, def)
  }

  private validate(def: RaceDefinition): void {
    const fail = (field: string, why: string): never => {
      throw new Error(`Invalid race definition: ${field} ${why}.`)
    }
    if (!def.id || def.id.trim() === '') fail('id', 'must be non-empty')
    if (!def.name || def.name.trim() === '') fail('name', 'must be non-empty')
    for (const field of ['maxHp', 'radius', 'speed', 'damageTaken', 'weaponSpin'] as const) {
      if (!(def[field] > 0) || !Number.isFinite(def[field])) fail(field, 'must be a finite number > 0')
    }
  }

  get(id: string): RaceDefinition | undefined {
    return this.defs.get(id)
  }

  has(id: string): boolean {
    return this.defs.has(id)
  }

  ids(): readonly string[] {
    return [...this.defs.keys()]
  }
}

/** Singleton populated by importing the race files. */
export const raceRegistry = new RaceRegistry()

export interface BallStats {
  maxHp: number
  radius: number
  speed: number
  damageTaken: number
  weaponSpin: number
}

/**
 * A ball's effective body stats. With a `raceId` the race supplies them all;
 * without one (balls saved before races) the config's own `maxHp`/`radius`
 * apply with neutral multipliers. Throws on an unknown race id.
 */
export function ballStats(config: BallConfig): BallStats {
  if (config.raceId === undefined) {
    return { maxHp: config.maxHp, radius: config.radius, speed: 1, damageTaken: 1, weaponSpin: 1 }
  }
  const race = raceRegistry.get(config.raceId)
  if (!race) throw new Error(`Unknown race id: ${config.raceId}.`)
  const { maxHp, radius, speed, damageTaken, weaponSpin } = race
  return { maxHp, radius, speed, damageTaken, weaponSpin }
}
