export const SEED_MIN = 0
export const SEED_MAX = 4_294_967_295 // 2^32 - 1

/** Thrown when a seed is non-integer or outside [SEED_MIN, SEED_MAX] (Req 5.9). */
export class InvalidSeedError extends Error {
  constructor(seed: number) {
    super(
      `Invalid seed: ${seed}. Seed must be an integer in [${SEED_MIN}, ${SEED_MAX}].`,
    )
    this.name = 'InvalidSeedError'
  }
}

export interface Rng {
  /** next float in [0, 1) */
  next(): number
  /** next integer in [0, n) for integer n > 0 */
  nextInt(n: number): number
  /** current internal state, for snapshotting/debugging */
  readonly state: number
}

/**
 * Creates a deterministic mulberry32 RNG (Req 5.2).
 * Validates the seed and throws `InvalidSeedError` before any use (Req 5.9).
 * Uses no `Math.random` and no wall-clock (Req 5.3).
 */
export function createRng(seed: number): Rng {
  if (!Number.isInteger(seed) || seed < SEED_MIN || seed > SEED_MAX) {
    throw new InvalidSeedError(seed)
  }

  // 32-bit state advanced per call.
  let s = seed >>> 0

  function next(): number {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  function nextInt(n: number): number {
    if (!Number.isInteger(n) || n <= 0) {
      throw new RangeError(`nextInt(n) requires an integer n > 0, got ${n}.`)
    }
    return Math.floor(next() * n)
  }

  return {
    next,
    nextInt,
    get state() {
      return s
    },
  }
}
