import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'
import { thrust } from './behaviors/thrust'

/** Spear: held, greatest length among starters (Req 10.11). A tip hit thrusts
 *  the ball away; driven into a wall, it takes extra damage. */
export const spear: WeaponDefinition = {
  id: 'spear',
  name: 'Spear',
  mode: 'orbit',
  length: 72, // longest starter
  damage: 6,
  angularSpeed: 3.0,
  weight: 8,
  hitCooldown: 600,
  behaviors: [thrust({
    fraction: 0.2, // outer 20% of the spear
    launchSpeed: 480,
    holdSteps: 20, // held out for 0.33 s
    wallSlam: { damage: 7, windowSteps: 45 }, // wall within 0.75 s → +7
  })],
  hitbox: { shape: 'segment', length: 72, thickness: 8 },
  spriteId: 'weapon:spear',
  pivot: { x: 6, y: 6 },
  spriteReach: 42,
}

weaponRegistry.register(spear)
