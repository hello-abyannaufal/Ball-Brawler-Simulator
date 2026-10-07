import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'

/** Orbiting blade: orbit mode, uses angularSpeed + orbit radius (Req 10.11). */
export const orbitingBlade: WeaponDefinition = {
  id: 'orbiting-blade',
  name: 'Orbiting Blade',
  mode: 'orbit',
  length: 25, // orbit radius offset
  damage: 4,
  angularSpeed: 4, // rad/s
  weight: 6,
  hitCooldown: 300,
  hitbox: { shape: 'circle', radius: 6 },
}

weaponRegistry.register(orbitingBlade)
