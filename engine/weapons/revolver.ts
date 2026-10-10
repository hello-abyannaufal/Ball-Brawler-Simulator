import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'
import { shooter } from './behaviors/shooter'

/**
 * Revolver: once it has the opponent in its sights it stops spinning and fans
 * the hammer — a quick string of bullets while the target stays in view — then
 * spins again while it reloads. Bullets can be swatted or riposted like arrows,
 * and the still, locked gun is easy to clash.
 */
export const revolver: WeaponDefinition = {
  id: 'revolver',
  name: 'Revolver',
  mode: 'orbit',
  length: 30,
  damage: 0, // deals damage via bullets, not melee
  angularSpeed: 3.0,
  weight: 7,
  hitCooldown: 400,
  hitbox: { shape: 'segment', length: 30, thickness: 8 },
  behaviors: [shooter({
    speed: 520,
    radius: 3, // circle at the bullet tip
    damage: 2,
    fireInterval: 6,
    facingDegrees: 6,
    blockable: true,
    knockback: 25, // a small shove per bullet (melee hits push 50)
    magazine: { size: 6, reloadSteps: 225 }, // 3.75 s reload
    aimLock: { holdDegrees: 20 },
  })],
  spriteId: 'weapon:revolver',
  pivot: { x: 8, y: 14 }, // on the barrel axis, so the barrel points where it aims
  spriteReach: 21, // pivot → muzzle
  projectileSprite: { id: 'projectile:bullet', pivot: { x: 4.5, y: 1.5 } }, // pivot on the tip
}

weaponRegistry.register(revolver)
