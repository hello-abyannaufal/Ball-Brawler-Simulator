import type { RaceDefinition } from './types'
import { raceRegistry } from './registry'

/** Goblin: tiny and twitchy, the smallest target in the arena. */
export const goblin: RaceDefinition = {
  id: 'goblin',
  name: 'Goblin',
  maxHp: 88,
  radius: 24,
  speed: 1.3,
  damageTaken: 1,
  weaponSpin: 1.05,
}

raceRegistry.register(goblin)
