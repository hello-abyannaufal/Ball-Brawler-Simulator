import { invalid, type WeaponBehavior } from '../behavior'

export interface ReapConfig {
  readonly windowSteps: number // reap length
  readonly spinBoost: number // × spin while reaping
  readonly hitCooldownSteps: number // re-hit interval on the same ball while reaping
}

/**
 * Reap (Scythe): a hit starts a reap for `windowSteps`: the blade spins
 * `spinBoost` × faster and can hit the same ball again every
 * `hitCooldownSteps`, without knockback, so it keeps cutting. Once the reap
 * ends, every opponent is safe for the normal hit cooldown, so a new reap
 * can't chain straight on.
 */
export function reap(config: ReapConfig): WeaponBehavior<{ steps: number }> & { readonly config: ReapConfig } {
  if (!(config.windowSteps >= 1) || !Number.isInteger(config.windowSteps)) invalid('reap.windowSteps', 'must be an integer >= 1')
  if (!(config.spinBoost > 0)) invalid('reap.spinBoost', 'must be > 0')
  if (!(config.hitCooldownSteps >= 1) || !Number.isInteger(config.hitCooldownSteps)) {
    invalid('reap.hitCooldownSteps', 'must be an integer >= 1')
  }
  return {
    id: 'reap',
    config,
    init: () => ({ steps: 0 }),
    spinMultiplier: (s) => (s.steps > 0 ? config.spinBoost : 1),
    onStep({ world, owner, fullCooldownSteps, startCooldown }, s) {
      if (s.steps <= 0) return
      s.steps -= 1
      if (s.steps === 0) {
        for (const b of world.aliveBalls()) if (b.id !== owner.id) startCooldown(b.id, fullCooldownSteps)
      }
    },
    afterHit(_ctx, s, _target, hit) {
      if (s.steps <= 0) s.steps = config.windowSteps
      hit.cooldownSteps = config.hitCooldownSteps
      if (hit.knockback === 'push') hit.knockback = 'none' // keep cutting
    },
    active: (s) => s.steps > 0,
  }
}
