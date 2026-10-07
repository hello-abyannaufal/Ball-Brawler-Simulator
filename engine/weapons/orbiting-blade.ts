import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'

/** Orbiting blade: orbit mode, uses angularSpeed + orbit radius (Req 10.11). */
export const orbitingBlade: WeaponDefinition = {
  id: 'orbiting-blade',
  name: 'Orbiting Blade',
  mode: 'orbit',
  length: 28, // gap from ball surface to the blade's outer edge
  damage: 4,
  angularSpeed: 5, // rad/s
  weight: 6,
  hitCooldown: 300,
  hitbox: { shape: 'circle', radius: 14 },
  spriteId: 'weapon:orbiting-blade',
  iconId: 'icon:weapon:orbiting-blade',
  pivot: { x: 9, y: 16 },
  spriteReach: 14,
}

weaponRegistry.register(orbitingBlade)
