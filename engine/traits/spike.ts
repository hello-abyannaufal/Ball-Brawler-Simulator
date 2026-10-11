import type { TraitDefinition } from './types'
import { traitRegistry } from './registry'

/** Spike: melee hits on it hurt the attacker back, and so does bumping into it. */
export const spike: TraitDefinition = {
  id: 'spike',
  name: 'Spike',
  thorns: 0.2,
  contactDamage: 1,
}

traitRegistry.register(spike)
