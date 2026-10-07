import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'

/** Bow: held weapon with projectile settings present (Req 10.11). */
export const bow: WeaponDefinition = {
  id: 'bow',
  name: 'Bow',
  mode: 'held',
  length: 16,
  damage: 0, // deals damage via projectiles, not melee
  angularSpeed: 0,
  weight: 5,
  hitCooldown: 400,
  hitbox: { shape: 'segment', length: 16, thickness: 2 },
  projectile: {
    speed: 160,
    radius: 3,
    damage: 7,
    fireInterval: 90,
  },
}

weaponRegistry.register(bow)
