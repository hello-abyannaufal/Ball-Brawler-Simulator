import type { TraitDefinition } from './types'

/**
 * Registry of trait definitions. `register` validates every field, rejecting
 * invalid definitions with an error naming the offending field.
 */
export class TraitRegistry {
  private readonly defs = new Map<string, TraitDefinition>()

  register(def: TraitDefinition): void {
    this.validate(def)
    // Under dev HMR an edited definition module re-runs and re-registers its
    // id: replace it instead of throwing. Outside HMR duplicates still fail.
    if (this.defs.has(def.id) && !import.meta.hot) {
      throw new Error(`Duplicate trait id: ${def.id}.`)
    }
    this.defs.set(def.id, def)
  }

  private validate(def: TraitDefinition): void {
    const fail = (field: string, why: string): never => {
      throw new Error(`Invalid trait definition: ${field} ${why}.`)
    }
    if (!def.id || def.id.trim() === '') fail('id', 'must be non-empty')
    if (!def.name || def.name.trim() === '') fail('name', 'must be non-empty')
    for (const field of ['lifesteal', 'thorns', 'contactDamage'] as const) {
      const v = def[field]
      if (v !== undefined && !(v >= 0 && Number.isFinite(v))) fail(field, 'must be a finite number >= 0')
    }
  }

  get(id: string): TraitDefinition | undefined {
    return this.defs.get(id)
  }

  has(id: string): boolean {
    return this.defs.has(id)
  }

  ids(): readonly string[] {
    return [...this.defs.keys()]
  }
}

/** Singleton populated by importing the trait files. */
export const traitRegistry = new TraitRegistry()
