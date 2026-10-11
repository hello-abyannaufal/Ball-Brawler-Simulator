import { describe, expect, it } from 'vitest'
import type { BallConfig } from './config'
import type { Ball } from './entities'
import type { EngineEvent } from './events'
import { createEngine, engineVersion } from './engine'
import { spike, TraitRegistry, vampire } from './traits'
import './weapons'

const arena = { width: 360, height: 360 }

function ball(id: string, x: number, weaponId: string | null, traitId?: string, vx = 180): BallConfig {
  return {
    id,
    radius: 32,
    maxHp: 100,
    initialPosition: { x, y: 180 },
    initialVelocity: { x: vx, y: 90 },
    weapons: weaponId ? [{ weaponId }] : [],
    ...(traitId ? { traitId } : {}),
  }
}

/** Runs a duel up to `steps`, recording every event with the tick it fired on. */
function run(a: BallConfig, b: BallConfig, steps = 1200, setup?: (balls: Ball[]) => void) {
  const events: Array<EngineEvent & { tick: number }> = []
  const e = createEngine({
    seed: 1,
    config: { engineVersion, seed: 1, arenaConfig: arena, ballConfigs: [a, b] },
    onEvent: (ev) => events.push({ ...ev, tick: e.world.tick }),
  })
  const balls = e.world.entities.filter((x): x is Ball => x.kind === 'ball')
  setup?.(balls)
  for (let i = 0; i < steps && !e.ended; i++) e.step()
  return { events, balls }
}

const damages = (events: EngineEvent[]) => events.filter((x): x is Extract<EngineEvent, { type: 'damage' }> => x.type === 'damage')

describe('traits', () => {
  it('Vampire heals for part of the weapon damage it deals', () => {
    const { events, balls } = run(ball('a', 80, 'sword', 'vampire'), ball('b', 280, 'sword'), 1200, ([v]) => {
      v!.hp = 40 // room to heal
    })
    const [vamp, foe] = balls
    const i = events.findIndex((x) => x.type === 'damage' && x.attackerId === vamp!.id && x.source.tag === 'weapon')
    expect(i).toBeGreaterThanOrEqual(0)
    const hit = events[i] as Extract<EngineEvent, { type: 'damage' }>
    expect(events[i + 1]).toMatchObject({ type: 'heal', ballId: vamp!.id, fromId: foe!.id })
    expect((events[i + 1] as Extract<EngineEvent, { type: 'heal' }>).amount).toBeCloseTo(hit.amount * vampire.lifesteal!)
  })

  it('Vampire never heals past max HP', () => {
    const { events, balls } = run(ball('a', 80, 'sword', 'vampire'), ball('b', 280, 'sword'))
    let hp = balls[0]!.maxHp
    for (const x of events) {
      if (x.type === 'damage' && x.targetId === balls[0]!.id) hp -= x.amount
      if (x.type === 'heal') hp += x.amount
      expect(hp).toBeLessThanOrEqual(balls[0]!.maxHp + 1e-9)
    }
  })

  it('Spike deals part of a melee hit back to the attacker', () => {
    const { events, balls } = run(ball('a', 80, 'sword'), ball('b', 280, 'sword', 'spike'))
    const [att, spiky] = balls
    const i = events.findIndex((x) => x.type === 'damage' && x.attackerId === att!.id && x.source.tag === 'weapon')
    expect(i).toBeGreaterThanOrEqual(0)
    const hit = events[i] as Extract<EngineEvent, { type: 'damage' }>
    expect(events[i + 1]).toMatchObject({ type: 'damage', source: { tag: 'reflect' }, attackerId: spiky!.id, targetId: att!.id })
    expect((events[i + 1] as Extract<EngineEvent, { type: 'damage' }>).amount).toBeCloseTo(hit.amount * spike.thorns!)
  })

  it('Spike does not reflect projectiles: its only spike damage on a Bow is contact', () => {
    const { events, balls } = run(ball('a', 80, 'bow'), ball('b', 280, 'sword', 'spike'))
    const spikes = damages(events).filter((x) => x.source.tag === 'reflect' && x.attackerId === balls[1]!.id)
    expect(damages(events).some((x) => x.source.tag === 'projectile' && x.targetId === balls[1]!.id)).toBe(true)
    for (const s of spikes) expect(s.amount).toBe(spike.contactDamage)
  })

  it('bumping into a Spike ball hurts, at most once per half second per opponent', () => {
    const { events, balls } = run(ball('a', 100, null, undefined, 200), ball('b', 260, null, 'spike', -200), 1200)
    const contact = events.filter((x) => x.type === 'damage' && x.source.tag === 'reflect')
    expect(contact.length).toBeGreaterThan(0)
    expect(contact[0]).toMatchObject({ attackerId: balls[1]!.id, targetId: balls[0]!.id, amount: spike.contactDamage })
    for (let i = 1; i < contact.length; i++) expect(contact[i]!.tick - contact[i - 1]!.tick).toBeGreaterThanOrEqual(30)
  })

  it('rejects unknown trait ids and invalid definitions', () => {
    expect(() => run(ball('a', 80, 'sword', 'nope'), ball('b', 280, 'sword'), 0)).toThrow(/Unknown trait id: nope/)
    const reg = new TraitRegistry()
    expect(() => reg.register({ id: 'x', name: 'X', lifesteal: -1 })).toThrow(/lifesteal/)
  })
})
