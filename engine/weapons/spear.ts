import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'

/** Spear: held, greatest length among starters (Req 10.11). */
export const spear: WeaponDefinition = {
  id: 'spear',
  name: 'Spear',
  mode: 'held',
  length: 40, // longest starter
  damage: 5,
  angularSpeed: 0,
  weight: 8,
  hitCooldown: 600,
  hitbox: { shape: 'segment', length: 40, thickness: 3 },
}

weaponRegistry.register(spear)
