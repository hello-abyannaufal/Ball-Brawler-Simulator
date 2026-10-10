import { describe, expect, it } from 'vitest'
import type { BallConfig } from './config'
import type { Ball, WeaponEntity } from './entities'
import type { EngineEvent } from './events'
import { createEngine, engineVersion } from './engine'
import { applyStatus, hasControl } from './status'
import './weapons'

const arena = { width: 360, height: 360 }

function ball(id: string, x: number): BallConfig {
  return {
    id,
    radius: 32,
    maxHp: 100,
    initialPosition: { x, y: 180 },
    initialVelocity: { x: 180, y: 90 },
    weapons: [{ weaponId: 'sword' }],
  }
}

function setup() {
  const events: EngineEvent[] = []
  const e = createEngine({
    seed: 1,
    config: { engineVersion, seed: 1, arenaConfig: arena, ballConfigs: [ball('a', 80), ball('b', 280)] },
    onEvent: (ev) => events.push(ev),
  })
  const [a, b] = e.world.entities.filter((x): x is Ball => x.kind === 'ball')
  return { e, a: a!, b: b!, events }
}

const steps = (e: { step(): void }, n: number) => {
  for (let i = 0; i < n; i++) e.step()
}

describe('status effects', () => {
  it('slow scales speed and spin from base, then restores them on expiry', () => {
    const { e, a, events } = setup()
    applyStatus(e.world, a.id, 'slow', '')
    e.step()
    expect(a.cruiseSpeed).toBeCloseTo(a.base.cruiseSpeed * 0.6)
    expect(a.weaponSpin).toBeCloseTo(a.base.weaponSpin * 0.7)

    // Applied between steps it still lasts its full duration (120 steps).
    steps(e, 119)
    expect(a.statusEffects).toHaveLength(1)
    e.step()
    expect(a.statusEffects).toHaveLength(0)
    expect(events).toContainEqual({ type: 'statusExpired', ballId: a.id, statusId: 'slow' })

    e.step()
    expect(a.cruiseSpeed).toBe(a.base.cruiseSpeed)
    expect(a.weaponSpin).toBe(a.base.weaponSpin)
  })

  it('poison stacks up to its cap and deals dot damage credited to the source', () => {
    const { e, a, b, events } = setup()
    for (let i = 0; i < 4; i++) applyStatus(e.world, a.id, 'poison', b.id)
    expect(a.statusEffects).toEqual([expect.objectContaining({ defId: 'poison', stacks: 3 })])

    steps(e, 31) // first tick fires 30 steps after the application step
    const dots = events.filter((ev) => ev.type === 'damage' && ev.source.tag === 'dot')
    expect(dots).toEqual([
      expect.objectContaining({ attackerId: b.id, targetId: a.id, amount: 6 }),
    ])
  })

  it('refresh resets the duration without stacking', () => {
    const { e, a } = setup()
    applyStatus(e.world, a.id, 'slow', '')
    steps(e, 60)
    applyStatus(e.world, a.id, 'slow', '')
    expect(a.statusEffects).toEqual([expect.objectContaining({ stacks: 1, remaining: 120 })])
  })

  it('stun freezes the ball\'s weapons until it expires', () => {
    const { e, a } = setup()
    const sword = e.world.entities.find((x): x is WeaponEntity => x.kind === 'weapon' && x.ownerId === a.id)!
    applyStatus(e.world, a.id, 'stun', '')
    expect(hasControl(a, 'stun')).toBe(true)

    const angle = sword.angle
    steps(e, 46)
    expect(sword.angle).toBe(angle)
    expect(hasControl(a, 'stun')).toBe(false)

    e.step()
    expect(sword.angle).not.toBe(angle)
  })

  it('rejects an unknown status id by name', () => {
    const { e, a } = setup()
    expect(() => applyStatus(e.world, a.id, 'nope', '')).toThrow('Unknown status id: nope.')
  })
})
