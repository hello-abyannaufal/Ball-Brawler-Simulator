// Importing this module registers all starter weapons as a side effect.
export { sword } from './sword'
export { hammer } from './hammer'
export { spear } from './spear'
export { bow } from './bow'
export { scythe } from './scythe'
export { revolver } from './revolver'

export { weaponRegistry, WeaponRegistry } from './registry'
export type {
  WeaponDefinition,
  WeaponInstance,
  WeaponMode,
  Hitbox,
} from './types'
export type { WeaponBehavior, BehaviorContext, HitResponse } from './behavior'
export type { ProjectileSettings } from './behaviors/shooter'
