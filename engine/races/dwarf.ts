import type { RaceDefinition } from './types'
import { raceRegistry } from './registry'

/** Dwarf: short and stout; shrugs off part of every hit, but plods along. */
export const dwarf: RaceDefinition = {
  id: 'dwarf',
  name: 'Dwarf',
  maxHp: 88,
  radius: 28,
  speed: 0.9,
  damageTaken: 0.9,
  weaponSpin: 1,
}

raceRegistry.register(dwarf)
