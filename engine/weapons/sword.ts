import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'

/** Sword: the held baseline weapon (Req 10.11). */
export const sword: WeaponDefinition = {
  id: 'sword',
  name: 'Sword',
  mode: 'held',
  length: 20,
  damage: 6,
  angularSpeed: 0,
  weight: 10,
  hitCooldown: 500,
  hitbox: { shape: 'segment', length: 20, thickness: 4 },
}

weaponRegistry.register(sword)
