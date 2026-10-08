import type { RaceDefinition } from './types'
import { raceRegistry } from './registry'

/** Orc: big and tough, but slow to move and to swing. */
export const orc: RaceDefinition = {
  id: 'orc',
  name: 'Orc',
  maxHp: 115,
  radius: 36,
  speed: 0.85,
  damageTaken: 1,
  weaponSpin: 0.85,
}

raceRegistry.register(orc)
