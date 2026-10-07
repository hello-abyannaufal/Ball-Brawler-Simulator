import type { SkillDefinition } from './types'

/** Registry of skill definitions keyed by unique non-empty id (Req 9.1). */
export class SkillRegistry {
  private readonly defs = new Map<string, SkillDefinition>()

  register(def: SkillDefinition): void {
    const id = def.id
    if (!id || id.trim() === '') {
      throw new Error('Skill id must be a non-empty string.')
    }
    if (this.defs.has(id)) {
      throw new Error(`Duplicate skill id: ${id}.`)
    }
    this.defs.set(id, def)
  }

  get(id: string): SkillDefinition | undefined {
    return this.defs.get(id)
  }

  has(id: string): boolean {
    return this.defs.has(id)
  }

  ids(): readonly string[] {
    return [...this.defs.keys()]
  }
}

/** Singleton populated by importing the starter skill files. */
export const skillRegistry = new SkillRegistry()
