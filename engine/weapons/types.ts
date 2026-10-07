export type WeaponMode = 'held' | 'orbit' // only these two (Req 10.3)

export type Hitbox =
  | { shape: 'segment'; length: number; thickness: number }
  | { shape: 'circle'; radius: number } // tip circle/box

export interface ProjectileSettings {
  speed: number
  radius: number
  damage: number
  fireInterval: number // steps
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
  readonly cannotBeParried?: boolean // Hammer (Req 10.11, 10.12)
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
