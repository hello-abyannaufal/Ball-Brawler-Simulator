import { describe, expect, it } from 'vitest'
import type { BallConfig } from './config'
import type { Ball, WeaponEntity } from './entities'
import { createEngine, engineVersion, TIMESTEP } from './engine'
import { applyDamage } from './damage'
import { raceRegistry, RaceRegistry, ballStats } from './races'
import './weapons'

const arena = { width: 360, height: 360 }

function ball(id: string, x: number, raceId?: string): BallConfig {
  return {
    id,
    radius: 32,
    maxHp: 100,
    initialPosition: { x, y: 180 },
    initialVelocity: { x: 180, y: 90 },
    weapons: [{ weaponId: 'sword' }],
    ...(raceId ? { raceId } : {}),
  }
}

function engineWith(a: BallConfig, b: BallConfig) {
  return createEngine({ seed: 1, config: { engineVersion, seed: 1, arenaConfig: arena, ballConfigs: [a, b] } })
}

const balls = (e: ReturnType<typeof engineWith>) => e.world.entities.filter((x): x is Ball => x.kind === 'ball')

describe('races', () => {
  it('a race replaces HP and radius and scales speed and weapon spin', () => {
    const e = engineWith(ball('a', 80, 'elf'), ball('b', 280, 'human'))
    const [elf, human] = balls(e)
    expect(elf!.maxHp).toBe(85)
    expect(elf!.hp).toBe(85)
    expect(elf!.radius).toBe(28)
    expect(elf!.cruiseSpeed).toBeCloseTo(Math.hypot(180, 90) * 1.2)
    expect(human!.cruiseSpeed).toBeCloseTo(Math.hypot(180, 90))

    const sword = e.world.entities.find((x): x is WeaponEntity => x.kind === 'weapon' && x.ownerId === elf!.id)!
    e.step()
    expect(sword.angle).toBeCloseTo(sword.def.angularSpeed * 1.15 * TIMESTEP)
  })

  it('a ball without a race keeps its own HP and radius with neutral multipliers', () => {
    expect(ballStats({ ...ball('a', 80), maxHp: 70, radius: 20 })).toEqual({
      maxHp: 70, radius: 20, speed: 1, damageTaken: 1, weaponSpin: 1,
    })
  })

  it('damageTaken scales every incoming hit', () => {
    raceRegistry.register({ id: 'test-tough', name: 'Tough', maxHp: 100, radius: 32, speed: 1, damageTaken: 0.5, weaponSpin: 1 })
    const e = engineWith(ball('a', 80, 'test-tough'), ball('b', 280, 'human'))
    const [tough, human] = balls(e)
    applyDamage(e.world, { source: { tag: 'weapon' }, attackerId: human!.id, targetId: tough!.id, amount: 10 })
    expect(tough!.hp).toBe(95)
  })

  it('rejects unknown race ids and invalid definitions', () => {
    expect(() => engineWith(ball('a', 80, 'nope'), ball('b', 280))).toThrow(/Unknown race id: nope/)
    const reg = new RaceRegistry()
    expect(() => reg.register({ id: 'x', name: 'X', maxHp: 100, radius: 32, speed: 0, damageTaken: 1, weaponSpin: 1 }))
      .toThrow(/speed/)
  })
})
