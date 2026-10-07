// Importing this module registers all five starter weapons as a side effect.
export { sword } from './sword'
export { hammer } from './hammer'
export { spear } from './spear'
export { shuriken } from './shuriken'
export { bow } from './bow'

export { weaponRegistry, WeaponRegistry } from './registry'
export type {
  WeaponDefinition,
  WeaponInstance,
  WeaponMode,
  Hitbox,
  ProjectileSettings,
} from './types'
