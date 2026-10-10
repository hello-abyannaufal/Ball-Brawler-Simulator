import type { Ball, WeaponEntity } from '../../entities'
import { invalid, type WeaponBehavior } from '../behavior'
import { bladeHitFraction } from '../combat'

/** Render-only lunge: the spear shoots out (its tip piercing the ball), stays
 *  out, then draws back over the hold. Steps since the thrust → share of LUNGE. */
const LUNGE = 18 // arena px
const LUNGE_OUT = 2 // steps to full reach
const LUNGE_BACK = 8 // final steps spent drawing back

export interface ThrustConfig {
  readonly fraction: number // outer share of the shaft that counts as the tip
  readonly launchSpeed: number // the struck ball is driven straight away at this speed
  readonly holdSteps: number // the spear stops spinning, held out along the thrust
  /** If the struck ball hits a wall within `windowSteps`, it takes `damage`
   *  once more and gets `statusId` (e.g. pinned: stun). */
  readonly wallSlam: { readonly damage: number; readonly windowSteps: number; readonly statusId?: string }
}

/**
 * Thrust (Spear, segment hitbox): a hit landing in the outer `fraction` of the
 * shaft drives the ball away and holds the spear still for `holdSteps`, as if
 * pushing it; slammed into a wall, the ball takes extra damage and is pinned.
 * Every tip hit thrusts; only the normal hit cooldown spaces them out.
 */
export function thrust(config: ThrustConfig): WeaponBehavior<{ hold: number }> {
  if (!(config.fraction > 0 && config.fraction <= 1)) invalid('thrust.fraction', 'must be in (0, 1]')
  if (!(config.launchSpeed > 0)) invalid('thrust.launchSpeed', 'must be > 0')
  if (!(config.holdSteps >= 0) || !Number.isInteger(config.holdSteps)) invalid('thrust.holdSteps', 'must be an integer >= 0')
  const tipHit = (weapon: WeaponEntity, target: Ball) => bladeHitFraction(weapon, target) >= 1 - config.fraction
  return {
    id: 'thrust',
    init: () => ({ hold: 0 }),
    spinMultiplier: (s) => (s.hold > 0 ? 0 : 1),
    onStep(_ctx, s) {
      if (s.hold > 0) s.hold -= 1
    },
    afterHit({ weapon }, s, target, hit) {
      if (!tipHit(weapon, target)) return
      s.hold = config.holdSteps
      hit.knockback = { launchSpeed: config.launchSpeed }
      hit.wallSlam = { ...config.wallSlam }
    },
    lunge(s) {
      if (s.hold <= 0) return 0
      const since = config.holdSteps - s.hold // 0 on the thrust step
      const out = Math.min(1, (since + 1) / LUNGE_OUT)
      const back = Math.min(1, s.hold / LUNGE_BACK)
      return LUNGE * Math.min(out, back)
    },
    heavyHit: tipHit,
  }
}
