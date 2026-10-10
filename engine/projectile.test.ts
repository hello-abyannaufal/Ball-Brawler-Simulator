import { describe, expect, it } from 'vitest'
import type { Ball, EntityId, Projectile } from './entities'
import type { EngineEvent } from './events'
import { createEngine, engineVersion } from './engine'
import './weapons'

const arena = { width: 360, height: 360 }

/** Two sword balls parked in the top corners; projectiles are added by hand below them. */
function setup() {
  const events: EngineEvent[] = []
  const ball = (id: string, x: number) => ({
    id, radius: 20, maxHp: 100,
    initialPosition: { x, y: 40 }, initialVelocity: { x: 0, y: 0 },
    weapons: [{ weaponId: 'sword' }],
  })
  const e = createEngine({
    seed: 1,
    config: { engineVersion, seed: 1, arenaConfig: arena, ballConfigs: [ball('a', 40), ball('b', 320)] },
    onEvent: (ev) => events.push(ev),
  })
  const [a, b] = e.world.entities.filter((x): x is Ball => x.kind === 'ball')
  const shoot = (ownerId: EntityId, x: number, vx: number): Projectile => {
    const p: Projectile = {
      id: e.world.allocateId(), kind: 'projectile', alive: true,
      position: { x, y: 300 }, velocity: { x: vx, y: 0 },
      radius: 4, damage: 7, ownerId, blockable: true, weaponId: 'bow', knockback: 0,
    }
    e.world.add(p)
    return p
  }
  return { e, a: a!, b: b!, events, shoot }
}

describe('projectile vs projectile', () => {
  it('opposing projectiles that meet destroy each other', () => {
    const { e, a, b, events, shoot } = setup()
    const p = shoot(a.id, 150, 320)
    const q = shoot(b.id, 210, -320)
    for (let i = 0; i < 10; i++) e.step()
    expect(p.alive).toBe(false)
    expect(q.alive).toBe(false)
    expect(events).toContainEqual(expect.objectContaining({ type: 'projectilesCollided' }))
  })

  it('fast head-on shots cannot pass through each other between steps', () => {
    const { e, a, b, shoot } = setup()
    // 15 px per step each: they swap sides within one step without ever overlapping at a step end.
    const p = shoot(a.id, 172, 900)
    const q = shoot(b.id, 188, -900)
    e.step()
    expect(p.alive).toBe(false)
    expect(q.alive).toBe(false)
  })

  it('projectiles of the same owner pass through each other', () => {
    const { e, a, shoot } = setup()
    const p = shoot(a.id, 150, 320)
    const q = shoot(a.id, 210, -320)
    for (let i = 0; i < 10; i++) e.step()
    expect(p.alive).toBe(true)
    expect(q.alive).toBe(true)
  })

  it('a projectile with knockback shoves the ball it hits along its flight', () => {
    const ball = (id: string, x: number) => ({
      id, radius: 20, maxHp: 100,
      initialPosition: { x, y: 180 }, initialVelocity: { x: 0, y: 0 },
      weapons: [],
    })
    const e = createEngine({
      seed: 1,
      config: { engineVersion, seed: 1, arenaConfig: arena, ballConfigs: [ball('a', 40), ball('b', 300)] },
    })
    const [a, b] = e.world.entities.filter((x): x is Ball => x.kind === 'ball')
    e.world.add({
      id: e.world.allocateId(), kind: 'projectile', alive: true,
      position: { x: 240, y: 180 }, velocity: { x: 320, y: 0 },
      radius: 3, damage: 2, ownerId: a!.id, blockable: true, weaponId: 'revolver', knockback: 25,
    })
    for (let i = 0; i < 10 && b!.hp === 100; i++) e.step()
    expect(b!.hp).toBeLessThan(100)
    expect(b!.velocity.x).toBeGreaterThan(20)
    expect(Math.abs(b!.velocity.y)).toBeLessThan(1e-9)
  })
})
