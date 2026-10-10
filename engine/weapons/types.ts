export type WeaponMode = 'held' | 'orbit' // only these two (Req 10.3)

export type Hitbox =
  | { shape: 'segment'; length: number; thickness: number }
  | { shape: 'circle'; radius: number } // tip circle/box

export interface ProjectileSettings {
  speed: number
  radius: number
  damage: number
  fireInterval: number // steps
  /** Fires only while the weapon points within ±this many degrees of the
   *  nearest opponent (default 15). */
  facingDegrees?: number
}

export interface WeaponDefinition {
  readonly id: string // unique non-empty (Req 10.1)
  readonly name: string // non-empty
  readonly mode: WeaponMode
  readonly length: number // > 0
  readonly damage: number // >= 0
  readonly angularSpeed: number // rad/s
  readonly weight: number // > 0
  readonly hitCooldown: number // ms, >= 0
  readonly hitbox: Hitbox
  readonly projectile?: ProjectileSettings // optional (Req 10.1, 10.10)
  /** Heavy blow: on a hit, launch the struck ball straight away at this speed
   *  (replaces its velocity). Without it a hit adds the base knockback impulse. */
  readonly launchSpeed?: number
  /** Solid weapon: its spin reverses on a hit, so it bounces off the ball
   *  instead of sweeping through it. */
  readonly reboundOnHit?: boolean
  /** After a hit, if the struck ball hits a wall within `windowSteps`, it
   *  takes `damage` once more (credited to the attacker, source `weapon`). */
  readonly wallSlam?: { readonly damage: number; readonly windowSteps: number }
  /** Sword: after any clash it isn't disarmed in, a riposte is ready for
   *  `windowSteps`: the next hit deals `multiplier` × damage. While ready, the
   *  blade spins `spinBoost` × faster, turned toward the opponent, and (if
   *  `reflectProjectiles`) sends opposing projectiles it touches back at their
   *  shooter instead of destroying them. Spent by the boosted hit. */
  readonly riposte?: {
    readonly multiplier: number
    readonly windowSteps: number
    readonly spinBoost?: number
    readonly reflectProjectiles?: boolean
  }
  /** Scythe: a hit starts a reap for `windowSteps`: the blade spins
   *  `spinBoost` × faster and can hit the same ball again every
   *  `hitCooldownSteps`, without knockback, so it keeps cutting. Once the reap
   *  ends, that ball is safe for the normal hitCooldown before the next one. */
  readonly reap?: {
    readonly windowSteps: number
    readonly spinBoost: number
    readonly hitCooldownSteps: number
  }
  /** Spear (segment hitbox): a hit landing in the outer `fraction` of the blade
   *  deals `multiplier` × damage. */
  readonly tipStrike?: { readonly fraction: number; readonly multiplier: number }
  /** Projectiles of this weapon are destroyed by any opposing non-projectile
   *  weapon they touch (Bow arrows can be swatted). */
  readonly projectileBlockable?: boolean
  // --- Visual-reference only. Ignored by the engine; no effect on simulation
  //     or determinism. Consumed solely by the app-layer renderer. ---
  readonly spriteId?: string // arena sprite id
  readonly iconId?: string // 16x16 roulette/library icon id
  readonly pivot?: { x: number; y: number } // sprite-pixel rotation point
  readonly spriteReach?: number // sprite pixels from pivot to tip; renderer scale = length / spriteReach
}

/** A weapon carried by a ball, resolved from a WeaponRef against the registry. */
export interface WeaponInstance {
  readonly def: WeaponDefinition
  state: Record<string, number> // e.g. firing timer for projectile weapons
}
