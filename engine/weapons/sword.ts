import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'

/** Sword: the orbiting baseline weapon (Req 10.11). */
export const sword: WeaponDefinition = {
  id: 'sword',
  name: 'Sword',
  mode: 'orbit',
  length: 48,
  damage: 6,
  angularSpeed: 4.0,
  weight: 10,
  hitCooldown: 500,
  hitbox: { shape: 'segment', length: 48, thickness: 10 },
  spriteId: 'weapon:sword',
  iconId: 'icon:weapon:sword',
  pivot: { x: 7, y: 16 },
  spriteReach: 25,
}

weaponRegistry.register(sword)
