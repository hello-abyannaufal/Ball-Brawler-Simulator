import type { WeaponBehavior } from '../behavior'
import { bladeHitFraction } from '../combat'

export interface TipStrikeConfig {
  readonly fraction: number // outer share of the blade that counts as the tip
  readonly multiplier: number // × damage of a tip hit
}

/** Tip strike (Spear, segment hitbox): a hit landing in the outer `fraction`
 *  of the blade deals `multiplier` × damage. */
export function tipStrike(config: TipStrikeConfig): WeaponBehavior<null> {
  return {
    id: 'tip-strike',
    init: () => null,
    hitMultiplier: ({ weapon }, _s, target) =>
      bladeHitFraction(weapon, target) >= 1 - config.fraction ? config.multiplier : 1,
  }
}
