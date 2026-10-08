import type { RaceDefinition } from './types'
import { raceRegistry } from './registry'

/** Human: the baseline every other race is measured against. */
export const human: RaceDefinition = {
  id: 'human',
  name: 'Human',
  maxHp: 100,
  radius: 32,
  speed: 1,
  damageTaken: 1,
  weaponSpin: 1,
}

raceRegistry.register(human)
