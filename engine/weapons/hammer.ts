import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'
import { heavyBlow } from './behaviors/heavyBlow'

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
  behaviors: [heavyBlow({
    launchSpeed: 540, // sends the target flying away
    reboundOnHit: true, // solid head bounces off instead of passing through
    wallSlam: { damage: 6, windowSteps: 45 }, // hit a wall within 0.75 s → +6
  })],
  spriteId: 'weapon:hammer',
  pivot: { x: 5, y: 16 },
  spriteReach: 26,
}

weaponRegistry.register(hammer)
