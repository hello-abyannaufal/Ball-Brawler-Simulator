import { mkdirSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { SEED_MAX } from '~/engine/rng'
import {
  AXES, axisStandings, buildFighters, headToHead, runRoundRobin, standings, type Standing,
} from './simulate'

/**
 * Balance simulation from the command line:
 *   npm run sim -- [--axes weapon,race] [--runs 200] [--seed N] [--max-seconds 120] [--no-save]
 *
 * Prints standings (and the head-to-head matrix when it fits) and saves the
 * full results as JSON under sim-results/.
 */

const USAGE = `Usage: npm run sim -- [options]
  --axes <list>        axes to compare, comma-separated (default: weapon)
                       known: ${AXES.map((a) => a.id).join(', ')}
  --runs <n>           duels per pair (default: 200)
  --seed <n>           base seed, for a reproducible run (default: random)
  --max-seconds <n>    sim seconds before a duel counts as a timeout (default: 120)
  --no-save            don't write sim-results/<timestamp>.json`

/** Widest matrix printed; past this only the standings are shown. */
const MATRIX_MAX = 12

function fail(msg: string): never {
  console.error(`${msg}\n\n${USAGE}`)
  process.exit(1)
}

function positiveInt(raw: string, flag: string): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) fail(`${flag} must be a positive integer.`)
  return n
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`

function printStandings(title: string, rows: readonly Standing[]): void {
  const w = Math.max(7, ...rows.map((r) => r.name.length))
  console.log(`\n${title}`)
  console.log(`${'#'.padStart(3)}  ${'Fighter'.padEnd(w)}  ${'Win'.padStart(6)}  ${'Draw'.padStart(6)}  ${'Timeout'.padStart(7)}  ${'Avg dur'.padStart(7)}  ${'Win HP'.padStart(6)}`)
  rows.forEach((r, i) => {
    console.log(
      `${String(i + 1).padStart(3)}  ${r.name.padEnd(w)}  ${pct(r.wins / r.games).padStart(6)}  ${pct(r.draws / r.games).padStart(6)}  `
      + `${pct(r.timeouts / r.games).padStart(7)}  ${`${r.avgSeconds.toFixed(1)}s`.padStart(7)}  ${pct(r.avgWinHp).padStart(6)}`,
    )
  })
}

const { values } = (() => {
  try {
    return parseArgs({
      options: {
        'axes': { type: 'string', default: 'weapon' },
        'runs': { type: 'string', default: '200' },
        'seed': { type: 'string' },
        'max-seconds': { type: 'string', default: '120' },
        'no-save': { type: 'boolean', default: false },
        'help': { type: 'boolean', short: 'h', default: false },
      },
    })
  } catch (err) {
    fail((err as Error).message)
  }
})()

if (values.help) {
  console.log(USAGE)
  process.exit(0)
}

const axes = values.axes.split(',').map((a) => a.trim()).filter(Boolean)
const runs = positiveInt(values.runs, '--runs')
const maxSeconds = positiveInt(values['max-seconds'], '--max-seconds')
const seed = values.seed === undefined ? Math.floor(Math.random() * (SEED_MAX + 1)) : Number(values.seed)
if (!Number.isInteger(seed) || seed < 0 || seed > SEED_MAX) fail(`--seed must be an integer 0–${SEED_MAX}.`)

let fighters
try {
  fighters = buildFighters(axes)
} catch (err) {
  fail((err as Error).message)
}
if (fighters.length < 2) fail('Need at least 2 fighters: compare an axis with more than one value.')

const pairCount = (fighters.length * (fighters.length - 1)) / 2
console.log(`${fighters.length} fighters, ${pairCount} pairs × ${runs} duels = ${pairCount * runs} duels (seed ${seed})`)

const started = performance.now()
const pairs = runRoundRobin(fighters, {
  runs,
  seed,
  maxSeconds,
  onPair: (done, total) => process.stdout.write(`\rSimulating… ${done}/${total} pairs`),
})
process.stdout.write(`\rDone in ${((performance.now() - started) / 1000).toFixed(1)}s.${' '.repeat(20)}\n`)

const ranked = standings(fighters, pairs)
printStandings('Standings (all games)', ranked)
if (axes.length > 1) {
  for (const axis of axes) printStandings(`By ${axis} (pooled)`, axisStandings(axis, fighters, pairs))
}

if (fighters.length <= MATRIX_MAX) {
  // Row's win rate against column, in standings order.
  const order = ranked.map((r) => fighters.findIndex((f) => f.name === r.name))
  const w = Math.max(...fighters.map((f) => f.name.length))
  const cw = 7
  console.log('\nHead-to-head (row win rate vs column)')
  console.log(`${''.padEnd(w)}  ${order.map((i) => fighters[i]!.name.slice(0, cw).padStart(cw)).join(' ')}`)
  for (const r of order) {
    const cells = order.map((c) => {
      const v = headToHead(pairs, r, c)
      return (v === null ? '-' : pct(v)).padStart(cw)
    })
    console.log(`${fighters[r]!.name.padEnd(w)}  ${cells.join(' ')}`)
  }
}

if (!values['no-save']) {
  mkdirSync('sim-results', { recursive: true })
  const file = `sim-results/${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(file, JSON.stringify({
    options: { axes, runs, seed, maxSeconds },
    fighters: fighters.map((f) => ({ name: f.name, values: f.values })),
    standings: ranked,
    pairs,
  }, null, 2))
  console.log(`\nSaved ${file}`)
}
