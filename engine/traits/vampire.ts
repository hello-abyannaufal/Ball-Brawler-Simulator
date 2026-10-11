import type { TraitDefinition } from './types'
import { traitRegistry } from './registry'

/** Vampire: every hit it lands heals it for part of the damage. */
export const vampire: TraitDefinition = {
  id: 'vampire',
  name: 'Vampire',
  lifesteal: 0.25,
}

traitRegistry.register(vampire)
