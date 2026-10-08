/**
 * A ball's race: its body. Absolute HP and size plus multipliers on movement,
 * incoming damage, and weapon spin. Resolved by the engine from
 * `BallConfig.raceId`, like weapons, so retuning a race updates saved balls.
 */
export interface RaceDefinition {
  readonly id: string // unique non-empty
  readonly name: string // non-empty
  readonly maxHp: number // > 0
  readonly radius: number // > 0
  readonly speed: number // × the duel's start/cruise speed, > 0
  readonly damageTaken: number // × every incoming damage amount, > 0
  readonly weaponSpin: number // × the spin speed of every carried weapon, > 0
}
