import type { BallConfig, DuelConfig } from '~/engine/config'
import { createEngine, engineVersion, TIMESTEP } from '~/engine/engine'
import type { Ball } from '~/engine/entities'
import { createRng, SEED_MAX } from '~/engine/rng'
import { raceRegistry } from '~/engine/races/registry'
import '~/engine/races/index' // populate the registry
import { weaponRegistry } from '~/engine/weapons/registry'
import '~/engine/weapons/index' // populate the registry
import { placeForDuel } from '~/utils/duel'

/**
 * Headless balance simulation: round-robin duels between fighters, no
 * rendering. A fighter is a full BallConfig, so anything a ball can be
 * configured with can be compared. Pure (no I/O), shared by the CLI and any
 * future UI.
 */

/** Same arena as Versus. */
export const ARENA = { width: 360, height: 360 }

/**
 * One thing fighters can differ in. Axes not being compared use `fallback`.
 * To compare a new parameter (e.g. abilities), add an axis here.
 */
export interface Axis {
  id: string
  values(): readonly string[]
  fallback: string
  name(value: string): string
  apply(config: BallConfig, value: string): BallConfig
}

export const AXES: readonly Axis[] = [
  {
    id: 'weapon',
    values: () => weaponRegistry.ids(),
    fallback: 'sword',
    name: (v) => weaponRegistry.get(v)?.name ?? v,
    apply: (c, v) => ({ ...c, weapons: [{ weaponId: v }] }),
  },
  {
    id: 'race',
    values: () => raceRegistry.ids(),
    fallback: 'human',
    name: (v) => raceRegistry.get(v)?.name ?? v,
    apply: (c, v) => ({ ...c, raceId: v }),
  },
]

export interface Fighter {
  name: string
  /** Axis id → value, for every axis (compared or fallback). */
  values: Record<string, string>
  config: BallConfig
}

/** Every combination of the compared axes' values; other axes use their fallback. */
export function buildFighters(axisIds: readonly string[]): Fighter[] {
  const unknown = axisIds.filter((id) => !AXES.some((a) => a.id === id))
  if (unknown.length) throw new Error(`Unknown axis: ${unknown.join(', ')}. Known: ${AXES.map((a) => a.id).join(', ')}.`)
  let combos: Record<string, string>[] = [{}]
  for (const axis of AXES) {
    const values = axisIds.includes(axis.id) ? axis.values() : [axis.fallback]
    combos = combos.flatMap((c) => values.map((v) => ({ ...c, [axis.id]: v })))
  }
  return combos.map((values, i) => {
    let config: BallConfig = {
      id: `fighter-${i}`,
      radius: 32, // replaced by the race's stats
      maxHp: 100,
      initialPosition: { x: 0, y: 0 }, // placeForDuel sets the real start
      initialVelocity: { x: 0, y: 0 },
      weapons: [],
    }
    for (const axis of AXES) config = axis.apply(config, values[axis.id]!)
    const name = AXES.filter((a) => axisIds.includes(a.id)).map((a) => a.name(values[a.id]!)).join(' / ')
    return { name, values, config }
  })
}

export interface DuelResult {
  /** Index into the configs passed to runDuel, or null for a draw/timeout. */
  winner: number | null
  timeout: boolean
  steps: number
  /** The winner's HP left, 0–1 (0 when there is no winner). */
  winnerHp: number
}

/** One duel, stepped until it ends or `maxSteps` pass (a timeout, scored as a draw). */
export function runDuel(configs: readonly [BallConfig, BallConfig], seed: number, maxSteps: number): DuelResult {
  const duel: DuelConfig = {
    engineVersion,
    seed,
    ballConfigs: placeForDuel(configs, ARENA, seed), // random starts, as in Versus
    arenaConfig: ARENA,
  }
  const engine = createEngine({ seed, config: duel })
  while (!engine.ended && engine.world.tick < maxSteps) engine.step()
  // Balls are created in ballConfigs order.
  const balls = engine.world.entities.filter((e): e is Ball => e.kind === 'ball')
  const idx = engine.winner == null ? -1 : balls.findIndex((b) => b.id === engine.winner)
  const result: DuelResult = {
    winner: idx >= 0 ? idx : null,
    timeout: !engine.ended,
    steps: engine.world.tick,
    winnerHp: idx >= 0 ? Math.max(0, balls[idx]!.hp) / balls[idx]!.maxHp : 0,
  }
  engine.dispose()
  return result
}

export interface PairResult {
  a: number // fighter index
  b: number
  games: number
  aWins: number
  bWins: number
  draws: number // includes timeouts
  timeouts: number
  steps: number // summed over games
  aWinHp: number // HP fraction left, summed over a's wins
  bWinHp: number
}

export interface SimOptions {
  runs: number // duels per pair
  seed: number
  maxSeconds: number // sim time before a duel counts as a timeout
  onPair?: (done: number, total: number) => void
}

/** Every fighter against every other one, `runs` duels per pair, sides swapped each duel. */
export function runRoundRobin(fighters: readonly Fighter[], opts: SimOptions): PairResult[] {
  const rng = createRng(opts.seed)
  const maxSteps = Math.round(opts.maxSeconds / TIMESTEP)
  const total = (fighters.length * (fighters.length - 1)) / 2
  const pairs: PairResult[] = []
  for (let a = 0; a < fighters.length; a++) {
    for (let b = a + 1; b < fighters.length; b++) {
      const p: PairResult = { a, b, games: 0, aWins: 0, bWins: 0, draws: 0, timeouts: 0, steps: 0, aWinHp: 0, bWinHp: 0 }
      for (let i = 0; i < opts.runs; i++) {
        const seed = Math.floor(rng.next() * (SEED_MAX + 1))
        // Alternate sides so the first slot's placement never favors one fighter.
        const swap = i % 2 === 1
        const configs = [fighters[a]!.config, fighters[b]!.config] as const
        const r = runDuel(swap ? [configs[1], configs[0]] : configs, seed, maxSteps)
        p.games++
        p.steps += r.steps
        if (r.timeout) p.timeouts++
        if (r.winner === null) p.draws++
        else if ((r.winner === 0) !== swap) {
          p.aWins++
          p.aWinHp += r.winnerHp
        } else {
          p.bWins++
          p.bWinHp += r.winnerHp
        }
      }
      pairs.push(p)
      opts.onPair?.(pairs.length, total)
    }
  }
  return pairs
}

export interface Standing {
  name: string
  games: number
  wins: number
  draws: number
  timeouts: number
  /** Average duel length in seconds, over this fighter's games. */
  avgSeconds: number
  /** Average HP left (0–1) when this fighter wins. */
  avgWinHp: number
}

function standing(name: string, pairs: readonly PairResult[], has: (i: number) => boolean): Standing {
  const s = { name, games: 0, wins: 0, draws: 0, timeouts: 0, avgSeconds: 0, avgWinHp: 0 }
  let steps = 0
  let winHp = 0
  for (const p of pairs) {
    // A pair inside the group (e.g. two Elf fighters) counts for both sides.
    for (const [side, wins, hp] of [[p.a, p.aWins, p.aWinHp], [p.b, p.bWins, p.bWinHp]] as const) {
      if (!has(side)) continue
      s.games += p.games
      s.wins += wins
      winHp += hp
      s.draws += p.draws
      s.timeouts += p.timeouts
      steps += p.steps
    }
  }
  s.avgSeconds = s.games ? (steps * TIMESTEP) / s.games : 0
  s.avgWinHp = s.wins ? winHp / s.wins : 0
  return s
}

/** Per-fighter standings, best win rate first. */
export function standings(fighters: readonly Fighter[], pairs: readonly PairResult[]): Standing[] {
  return fighters
    .map((f, i) => standing(f.name, pairs, (j) => j === i))
    .sort((x, y) => y.wins / (y.games || 1) - x.wins / (x.games || 1))
}

/** Standings per value of one axis, pooled over all fighters with that value. */
export function axisStandings(axisId: string, fighters: readonly Fighter[], pairs: readonly PairResult[]): Standing[] {
  const axis = AXES.find((a) => a.id === axisId)!
  const values = [...new Set(fighters.map((f) => f.values[axisId]!))]
  return values
    .map((v) => standing(axis.name(v), pairs, (i) => fighters[i]!.values[axisId] === v))
    .sort((x, y) => y.wins / (y.games || 1) - x.wins / (x.games || 1))
}

/** Win rate of fighter `row` against `col` (0–1), or null on the diagonal. */
export function headToHead(pairs: readonly PairResult[], row: number, col: number): number | null {
  if (row === col) return null
  const p = pairs.find((q) => (q.a === row && q.b === col) || (q.a === col && q.b === row))
  if (!p || !p.games) return null
  return (p.a === row ? p.aWins : p.bWins) / p.games
}
