import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'
import { tipStrike } from './behaviors/tipStrike'

/** Spear: held, greatest length among starters (Req 10.11). */
export const spear: WeaponDefinition = {
  id: 'spear',
  name: 'Spear',
  mode: 'orbit',
  length: 72, // longest starter
  damage: 6,
  angularSpeed: 3.0,
  weight: 8,
  hitCooldown: 600,
  behaviors: [tipStrike({ fraction: 0.2, multiplier: 2 })], // outer 20% of the spear ×2
  hitbox: { shape: 'segment', length: 72, thickness: 8 },
  spriteId: 'weapon:spear',
  pivot: { x: 6, y: 6 },
  spriteReach: 42,
}

weaponRegistry.register(spear)
