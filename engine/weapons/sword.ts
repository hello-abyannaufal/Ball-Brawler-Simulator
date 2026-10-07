import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'

/** Sword: the orbiting baseline weapon (Req 10.11). */
export const sword: WeaponDefinition = {
  id: 'sword',
  name: 'Sword',
  mode: 'orbit',
  length: 48,
  damage: 8,
  angularSpeed: 4.0,
  weight: 10,
  hitCooldown: 500,
  // Any clash it isn't disarmed in → for 1 s: next hit ×2, blade spins 2.5×
  // toward the opponent, and projectiles it touches are reflected at the shooter.
  riposte: { multiplier: 2, windowSteps: 60, spinBoost: 2.5, reflectProjectiles: true },
  hitbox: { shape: 'segment', length: 48, thickness: 10 },
  spriteId: 'weapon:sword',
  iconId: 'icon:weapon:sword',
  pivot: { x: 7, y: 16 },
  spriteReach: 25,
}

weaponRegistry.register(sword)
