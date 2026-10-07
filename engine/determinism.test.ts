// Feature: ball-battle-simulator, Property 1: Determinism of seed and config
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import './weapons/index'
import { createEngine, engineVersion } from './engine'
import { weaponRegistry } from './weapons/registry'
import type { DuelConfig } from './config'
import type { EngineEvent } from './events'

const MAX_STEPS = 1200 // 20 s of sim; duels that run longer are compared up to here
const ARENA = { width: 360, height: 360 }

/** Everything observable about one run: events, per-step entity order, final state. */
function run(config: DuelConfig) {
  const events: EngineEvent[] = []
  const engine = createEngine({ seed: config.seed, config, onEvent: (e) => events.push(e) })
  const order: string[] = []
  for (let i = 0; i < MAX_STEPS && !engine.ended; i++) {
    engine.step()
    order.push(engine.world.entities.map((e) => e.id).join(','))
  }
  const final = engine.world.entities.map((e) => ({
    id: e.id,
    kind: e.kind,
    alive: e.alive,
    x: e.position.x,
    y: e.position.y,
    hp: e.kind === 'ball' ? e.hp : undefined,
  }))
  return { winner: engine.winner, tick: engine.world.tick, events, order, final }
}

const weaponId = fc.constantFrom(...weaponRegistry.ids())

const duelConfig = fc
  .record({
    seed: fc.integer({ min: 0, max: 0xffffffff }),
    w1: weaponId,
    w2: weaponId,
    r1: fc.integer({ min: 16, max: 40 }),
    r2: fc.integer({ min: 16, max: 40 }),
    hp: fc.integer({ min: 10, max: 100 }),
    vx: fc.integer({ min: -250, max: 250 }),
    vy: fc.integer({ min: -250, max: 250 }),
  })
  .map(({ seed, w1, w2, r1, r2, hp, vx, vy }): DuelConfig => ({
    engineVersion,
    seed,
    arenaConfig: ARENA,
    ballConfigs: [
      {
        id: 'a',
        radius: r1,
        maxHp: hp,
        initialPosition: { x: 100, y: 180 },
        initialVelocity: { x: vx, y: vy },
        weapons: [{ weaponId: w1 }],
      },
      {
        id: 'b',
        radius: r2,
        maxHp: hp,
        initialPosition: { x: 260, y: 180 },
        initialVelocity: { x: -vx, y: -vy },
        weapons: [{ weaponId: w2 }],
      },
    ],
  }))

describe('Property 1: determinism of seed and config (Req 5.5, 5.6, 11.10)', () => {
  it('two runs of the same seed + config are identical', () => {
    fc.assert(
      fc.property(duelConfig, (config) => {
        // structuredClone: the second run must not share any object with the first.
        const a = run(structuredClone(config))
        const b = run(structuredClone(config))
        expect(b.winner).toEqual(a.winner)
        expect(b.tick).toBe(a.tick)
        expect(b.final).toEqual(a.final)
        expect(b.order).toEqual(a.order)
        expect(b.events).toEqual(a.events)
      }),
      { numRuns: 100 },
    )
  })

  it('a duel that ends declares the same winner and HP on every run', () => {
    const config = (seed: number): DuelConfig => ({
      engineVersion,
      seed,
      arenaConfig: ARENA,
      ballConfigs: [
        { id: 'a', radius: 32, maxHp: 12, initialPosition: { x: 140, y: 180 }, initialVelocity: { x: 180, y: 90 }, weapons: [{ weaponId: 'hammer' }] },
        { id: 'b', radius: 32, maxHp: 12, initialPosition: { x: 220, y: 180 }, initialVelocity: { x: -180, y: -90 }, weapons: [{ weaponId: 'sword' }] },
      ],
    })
    const first = run(config(7))
    expect(first.winner).not.toBeUndefined() // this setup reaches matchEnded within MAX_STEPS
    for (let i = 0; i < 3; i++) expect(run(config(7))).toEqual(first)
  })
})
