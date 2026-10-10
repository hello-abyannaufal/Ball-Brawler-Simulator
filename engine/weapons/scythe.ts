import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'
import { reap } from './behaviors/reap'

/** Scythe: light blade hits that turn into a reap — a fast spin that cuts the
 *  same ball several times in a row. */
export const scythe: WeaponDefinition = {
  id: 'scythe',
  name: 'Scythe',
  mode: 'orbit',
  length: 46,
  damage: 6,
  angularSpeed: 3.6,
  weight: 15,
  hitCooldown: 800,
  hitbox: { shape: 'circle', radius: 14 }, // the blade, at the tip
  // A hit → for 1 s: spin 10× faster and re-hit the same ball every 4 steps
  // (≈ 2.2 hits per reap on average, up to ~7; 20 seeds × both slots).
  behaviors: [reap({ windowSteps: 60, spinBoost: 10, hitCooldownSteps: 4 })],
  spriteId: 'weapon:scythe',
  iconId: 'icon:weapon:scythe',
  pivot: { x: 5, y: 12 }, // above the shaft, so the tip hitbox sits on the blade
  spriteReach: 25,
}

weaponRegistry.register(scythe)
