// Importing this module registers all five starter skills as a side effect.
export { vampire } from './vampire'
export { spike } from './spike'
export { blaster } from './blaster'
export { splitter } from './splitter'
export { grower } from './grower'

export { skillRegistry, SkillRegistry } from './registry'
export type {
  SkillDefinition,
  SkillInstance,
  SkillContext,
} from './types'
