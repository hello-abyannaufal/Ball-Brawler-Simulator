import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'

/** Hammer: held, heaviest weight among starters, cannot be parried (Req 10.11, 10.12). */
export const hammer: WeaponDefinition = {
  id: 'hammer',
  name: 'Hammer',
  mode: 'held',
  length: 18,
  damage: 12,
  angularSpeed: 0,
  weight: 30, // heaviest starter
  hitCooldown: 900,
  hitbox: { shape: 'circle', radius: 10 },
  cannotBeParried: true,
}

weaponRegistry.register(hammer)
