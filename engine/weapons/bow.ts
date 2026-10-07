import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'

/** Bow: held weapon with projectile settings present (Req 10.11). */
export const bow: WeaponDefinition = {
  id: 'bow',
  name: 'Bow',
  mode: 'orbit',
  length: 24,
  damage: 0, // deals damage via projectiles, not melee
  angularSpeed: 2.8,
  weight: 5,
  hitCooldown: 400,
  hitbox: { shape: 'segment', length: 24, thickness: 8 },
  projectile: {
    speed: 160,
    radius: 3,
    damage: 7,
    fireInterval: 90,
  },
  spriteId: 'weapon:bow',
  iconId: 'icon:weapon:bow',
  pivot: { x: 19, y: 16 },
  spriteReach: 10,
}

weaponRegistry.register(bow)
