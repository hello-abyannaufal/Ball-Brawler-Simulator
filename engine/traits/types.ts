/**
 * A ball's trait: a passive effect that is always on. Resolved by the engine
 * from `BallConfig.traitId`, like races, so retuning a trait updates saved
 * balls. Every effect field is optional; a trait sets the ones it uses.
 */
export interface TraitDefinition {
  readonly id: string // unique non-empty
  readonly name: string // non-empty
  /** Fraction of the damage the ball deals (weapon, projectile, wall slam)
   *  that heals it. */
  readonly lifesteal?: number // >= 0
  /** Fraction of the damage taken from an opposing melee weapon that is
   *  dealt back to its owner. */
  readonly thorns?: number // >= 0
  /** Damage dealt to an opposing ball on body contact (rate-limited per
   *  opponent by the engine). */
  readonly contactDamage?: number // >= 0
}
