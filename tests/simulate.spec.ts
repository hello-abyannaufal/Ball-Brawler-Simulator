// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { raceRegistry } from '~/engine/races/registry'
import { weaponRegistry } from '~/engine/weapons/registry'
import { axisStandings, buildFighters, headToHead, runRoundRobin, standings } from '~/sim/simulate'

describe('buildFighters', () => {
  it('varies only the compared axes', () => {
    const fighters = buildFighters(['weapon'])
    expect(fighters).toHaveLength(weaponRegistry.ids().length)
    expect(fighters.every((f) => f.config.raceId === 'human')).toBe(true)
  })

  it('crosses several axes', () => {
    expect(buildFighters(['weapon', 'race'])).toHaveLength(weaponRegistry.ids().length * raceRegistry.ids().length)
  })

  it('rejects an unknown axis', () => {
    expect(() => buildFighters(['ability'])).toThrow(/Unknown axis: ability/)
  })
})

describe('runRoundRobin', () => {
  const fighters = buildFighters(['weapon']).slice(0, 3)
  const opts = { runs: 4, seed: 42, maxSeconds: 10 }

  it('plays every pair and accounts for every game', () => {
    const pairs = runRoundRobin(fighters, opts)
    expect(pairs).toHaveLength(3)
    for (const p of pairs) {
      expect(p.games).toBe(4)
      expect(p.aWins + p.bWins + p.draws).toBe(4)
    }
    for (const s of standings(fighters, pairs)) expect(s.games).toBe(8)
    expect(axisStandings('weapon', fighters, pairs)).toHaveLength(3)
  })

  it('is reproducible from the seed', () => {
    expect(runRoundRobin(fighters, opts)).toEqual(runRoundRobin(fighters, opts))
  })

  it('head-to-head rates of a pair add up with its draws', () => {
    const pairs = runRoundRobin(fighters, opts)
    const p = pairs[0]!
    expect(headToHead(pairs, p.a, p.b)! + headToHead(pairs, p.b, p.a)!).toBeCloseTo(1 - p.draws / p.games)
    expect(headToHead(pairs, 0, 0)).toBeNull()
  })
})
