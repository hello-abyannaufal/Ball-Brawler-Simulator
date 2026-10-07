import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'

/** Hammer: held, heaviest weight among starters, cannot be parried (Req 10.11, 10.12). */
export const hammer: WeaponDefinition = {
  id: 'hammer',
  name: 'Hammer',
  mode: 'orbit',
  length: 42,
  damage: 12,
  angularSpeed: 2.4, // heavy = slow spin
  weight: 30, // heaviest starter
  hitCooldown: 900,
  hitbox: { shape: 'circle', radius: 16 }, // the head, at the tip
  cannotBeParried: true,
  spriteId: 'weapon:hammer',
  iconId: 'icon:weapon:hammer',
  pivot: { x: 5, y: 16 },
  spriteReach: 26,
}

weaponRegistry.register(hammer)
