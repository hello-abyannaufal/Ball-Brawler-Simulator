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
  projectileBlockable: true, // arrows can be swatted by melee weapons
  hitbox: { shape: 'segment', length: 24, thickness: 8 },
  projectile: {
    speed: 320,
    radius: 4, // circle at the arrow tip
    damage: 7,
    fireInterval: 100,
    facingDegrees: 5, // narrow cone: fires less often
  },
  spriteId: 'weapon:bow',
  iconId: 'icon:weapon:bow',
  pivot: { x: 19, y: 16 },
  spriteReach: 10,
}

weaponRegistry.register(bow)
