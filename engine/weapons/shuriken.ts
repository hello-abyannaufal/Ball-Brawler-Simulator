import type { WeaponDefinition } from './types'
import { weaponRegistry } from './registry'

/**
 * Shuriken: a summoner. No blade of its own — it grows a ring of circling
 * shurikens (one every `intervalSteps`), and at `maxStack` throws the whole
 * ring in a fan at the opponent; thrown shurikens bounce off walls for a
 * while. Circling ones deal small damage and break when they touch the
 * opponent's ball, break when an opposing weapon touches them, and block arrows.
 */
export const shuriken: WeaponDefinition = {
  id: 'shuriken',
  name: 'Shuriken',
  mode: 'orbit',
  length: 1, // no blade; the shurikens are projectiles
  damage: 0,
  angularSpeed: 3, // spin of the circling ring
  weight: 6,
  hitCooldown: 0,
  hitbox: { shape: 'circle', radius: 0.5 },
  summon: {
    intervalSteps: 72, // 1.2 s per shuriken
    maxStack: 5,
    radius: 12, // matches the sprite drawn at 2× (~28 px)
    orbitGap: 18,
    orbitDamage: 3, // a circling shuriken that touches the opponent hits once and breaks
    throwSpeed: 300,
    throwDamage: 4,
    spreadDegrees: 45,
    bounceSteps: 120, // 2 s of wall bounces
  },
  spriteId: 'weapon:shuriken', // roulette/library icon; the arena draws the projectiles
  iconId: 'icon:weapon:shuriken',
}

weaponRegistry.register(shuriken)
