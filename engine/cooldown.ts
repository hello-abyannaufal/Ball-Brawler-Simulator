import type { EntityId } from './entities'

/**
 * Per-pair hit cooldown table (Req 7.5–7.8).
 *
 * Keyed by the ordered `(attackerId, targetId)` pair. While a pair's cooldown
 * is active, a repeated hit for that pair applies no damage, knockback, or
 * status change (Req 7.7) — callers must check `isActive` before interacting.
 */
export class CooldownTable {
  private readonly remaining = new Map<string, number>()

  private key(attackerId: EntityId | '', targetId: EntityId): string {
    return `${attackerId}->${targetId}`
  }

  /** True while the ordered pair still has cooldown remaining (Req 7.5). */
  isActive(attackerId: EntityId | '', targetId: EntityId): boolean {
    return (this.remaining.get(this.key(attackerId, targetId)) ?? 0) > 0
  }

  /** Start (or refresh) the cooldown for the ordered pair (Req 7.6). */
  start(attackerId: EntityId | '', targetId: EntityId, duration: number): void {
    if (duration <= 0) return
    this.remaining.set(this.key(attackerId, targetId), duration)
  }

  /** Decrement every active cooldown by one timestep per step (Req 7.8). */
  decrementAll(): void {
    for (const [k, v] of this.remaining) {
      const next = v - 1
      if (next <= 0) {
        this.remaining.delete(k)
      } else {
        this.remaining.set(k, next)
      }
    }
  }
}
