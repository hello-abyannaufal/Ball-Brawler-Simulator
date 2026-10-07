import { createRng } from './rng'

/** Thrown when a wheel has no entry with weight > 0 to draw from (Req 12.4). */
export class EmptyRegistryError extends Error {
  constructor(which: string) {
    super(`Cannot spin roulette: the ${which} wheel has no entries with weight > 0.`)
    this.name = 'EmptyRegistryError'
  }
}

/** One slice of a roulette wheel. Its share of the wheel is weight / total. */
export interface WheelSegment {
  id: string
  weight: number // >= 0; 0 = excluded from the wheel
}

export interface WheelResult {
  seed: number
  id: string // drawn segment id
  /** Where inside the drawn slice the pointer lands, in [0, 1). Cosmetic: lets
   *  the wheel animation stop at a varied but reproducible spot. */
  landing: number
}

/**
 * Weighted, seeded draw of exactly one segment (Req 12.1, 12.3, 12.5). Pure and
 * deterministic: the same seed + same segments (ids, order, weights) always
 * yields the same result; the input is never mutated. Generic over what the
 * wheel holds (weapons now; other kinds later). Throws `EmptyRegistryError`
 * when no segment has weight > 0 (Req 12.4).
 */
export function spinWheel(
  seed: number,
  segments: readonly WheelSegment[],
  which = 'weapon',
): WheelResult {
  const eligible = segments.filter((s) => Number.isFinite(s.weight) && s.weight > 0)
  if (eligible.length === 0) throw new EmptyRegistryError(which)

  const rng = createRng(seed) // validates seed; deterministic
  const total = eligible.reduce((sum, s) => sum + s.weight, 0)
  let roll = rng.next() * total
  let picked = eligible[eligible.length - 1]!
  for (const s of eligible) {
    if (roll < s.weight) {
      picked = s
      break
    }
    roll -= s.weight
  }
  // Keep away from the slice edges so the pointer clearly sits inside it.
  const landing = 0.15 + rng.next() * 0.7
  return { seed, id: picked.id, landing }
}
