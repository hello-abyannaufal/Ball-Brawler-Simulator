import type { RaceDefinition } from './types'
import { raceRegistry } from './registry'

/** Giant: a huge HP pool on a huge, slow target. */
export const giant: RaceDefinition = {
  id: 'giant',
  name: 'Giant',
  maxHp: 130,
  radius: 44,
  speed: 0.7,
  damageTaken: 1,
  weaponSpin: 0.8,
}

raceRegistry.register(giant)
