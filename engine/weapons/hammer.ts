import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'

/** Hammer: heaviest weight among starters, so it is never parried by a lighter weapon. */
export const hammer: WeaponDefinition = {
  id: 'hammer',
  name: 'Hammer',
  mode: 'orbit',
  length: 42,
  damage: 10,
  angularSpeed: 2.4, // heavy = slow spin
  weight: 30, // heaviest starter
  hitCooldown: 1100,
  hitbox: { shape: 'circle', radius: 16 }, // the head, at the tip
  launchSpeed: 540, // heavy blow: sends the target flying away
  reboundOnHit: true, // solid head bounces off instead of passing through
  wallSlam: { damage: 6, windowSteps: 45 }, // hit a wall within 0.75 s → +6
  spriteId: 'weapon:hammer',
  iconId: 'icon:weapon:hammer',
  pivot: { x: 5, y: 16 },
  spriteReach: 26,
}

weaponRegistry.register(hammer)
