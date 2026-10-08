import type { RaceDefinition } from './types'
import { raceRegistry } from './registry'

/** Elf: small and quick, ball and blade alike; pays in HP. */
export const elf: RaceDefinition = {
  id: 'elf',
  name: 'Elf',
  maxHp: 85,
  radius: 28,
  speed: 1.2,
  damageTaken: 1,
  weaponSpin: 1.15,
}

raceRegistry.register(elf)
