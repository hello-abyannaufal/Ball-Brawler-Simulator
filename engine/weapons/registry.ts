import type { WeaponDefinition } from './types'

/**
 * Registry of weapon definitions. `register` validates every required field and
 * bound, rejecting and excluding invalid definitions with an error naming the
 * offending field (Req 10.2).
 */
export class WeaponRegistry {
  private readonly defs = new Map<string, WeaponDefinition>()

  register(def: WeaponDefinition): void {
    this.validate(def)
    if (this.defs.has(def.id)) {
      throw new Error(`Duplicate weapon id: ${def.id}.`)
    }
    this.defs.set(def.id, def)
  }

  private validate(def: WeaponDefinition): void {
    const fail = (field: string, why: string): never => {
      throw new Error(`Invalid weapon definition: ${field} ${why}.`)
    }

    if (!def.id || def.id.trim() === '') fail('id', 'must be non-empty')
    if (!def.name || def.name.trim() === '') fail('name', 'must be non-empty')
    if (def.mode !== 'held' && def.mode !== 'orbit') {
      fail('mode', 'must be "held" or "orbit"')
    }
    if (!(def.length > 0)) fail('length', 'must be > 0')
    if (!(def.damage >= 0)) fail('damage', 'must be >= 0')
    if (!Number.isFinite(def.angularSpeed)) {
      fail('angularSpeed', 'must be a finite number')
    }
    if (!(def.weight > 0)) fail('weight', 'must be > 0')
    if (!(def.hitCooldown >= 0)) fail('hitCooldown', 'must be >= 0')
    if (!def.hitbox) fail('hitbox', 'is required')

    if (def.projectile) {
      const p = def.projectile
      if (!(p.speed > 0)) fail('projectile.speed', 'must be > 0')
      if (!(p.radius > 0)) fail('projectile.radius', 'must be > 0')
      if (!(p.damage >= 0)) fail('projectile.damage', 'must be >= 0')
      if (!(p.fireInterval >= 1) || !Number.isInteger(p.fireInterval)) {
        fail('projectile.fireInterval', 'must be an integer >= 1')
      }
    }
  }

  get(id: string): WeaponDefinition | undefined {
    return this.defs.get(id)
  }

  has(id: string): boolean {
    return this.defs.has(id)
  }

  ids(): readonly string[] {
    return [...this.defs.keys()]
  }
}

/** Singleton populated by importing the starter weapon files. */
export const weaponRegistry = new WeaponRegistry()
