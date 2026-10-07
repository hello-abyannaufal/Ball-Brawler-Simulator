import type { Ball, Entity, EntityId } from './entities'
import type { Rng } from './rng'
import type { ArenaConfig } from './config'
import type { EngineEvent } from './events'

/**
 * The entity container and simulation state (Req 5.5).
 * Entities live in a stable insertion-ordered array with monotonically
 * increasing integer ids so every pass iterates deterministically.
 */
export class World {
  readonly entities: Entity[] = []
  readonly rng: Rng
  readonly arena: ArenaConfig
  tick = 0 // whole steps elapsed

  private nextId = 0
  private readonly sink?: (e: EngineEvent) => void

  constructor(opts: {
    rng: Rng
    arena: ArenaConfig
    onEvent?: (e: EngineEvent) => void
  }) {
    this.rng = opts.rng
    this.arena = opts.arena
    this.sink = opts.onEvent
  }

  /** Allocates the next stable entity id. */
  allocateId(): EntityId {
    return this.nextId++
  }

  /** Appends an entity in stable order and returns its id. */
  add(entity: Entity): EntityId {
    this.entities.push(entity)
    return entity.id
  }

  ballById(id: EntityId): Ball | undefined {
    const e = this.entities.find((e) => e.id === id)
    return e && e.kind === 'ball' ? e : undefined
  }

  /** Living balls, order-preserving. */
  aliveBalls(): Ball[] {
    return this.entities.filter(
      (e): e is Ball => e.kind === 'ball' && e.alive,
    )
  }

  /** Emits an engine event through the sink, if any. */
  emit(event: EngineEvent): void {
    this.sink?.(event)
  }
}
