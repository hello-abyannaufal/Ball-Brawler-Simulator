import { describe, expect, it } from 'vitest'
import type { Ball, WeaponEntity } from './entities'
import type { EngineEvent } from './events'
import { createEngine, engineVersion } from './engine'
import { landsHeavy, weaponLunge } from './weapons/behavior'
import './weapons'

/** A still Spear ball at (100, 180), its spear pointing +x along y = 180,
 *  and a still, unarmed target at `at`. */
function setup(at: { x: number; y: number }) {
  const events: EngineEvent[] = []
  const heavy: boolean[] = [] // landsHeavy at each hit, asked as the renderer does
  const ball = (id: string, pos: { x: number; y: number }, weapons: { weaponId: string }[]) => ({
    id, radius: 20, maxHp: 100, initialPosition: pos, initialVelocity: { x: 0, y: 0 }, weapons,
  })
  const e = createEngine({
    seed: 1,
    config: {
      engineVersion, seed: 1, arenaConfig: { width: 360, height: 360 },
      ballConfigs: [ball('a', { x: 100, y: 180 }, [{ weaponId: 'spear' }]), ball('b', at, [])],
    },
    onEvent: (ev) => {
      events.push(ev)
      if (ev.type === 'damage' && ev.source.tag === 'weapon') heavy.push(landsHeavy(spear, b!))
    },
  })
  const [, b] = e.world.entities.filter((x): x is Ball => x.kind === 'ball')
  const spear = e.world.entities.find((x): x is WeaponEntity => x.kind === 'weapon')!
  return { e, b: b!, spear, events, heavy }
}

describe('Spear thrust', () => {
  it('a tip hit drives the ball into the wall, which pins it (+damage, stun)', () => {
    const { e, b, spear, events, heavy } = setup({ x: 200, y: 180 })
    e.step()
    expect(b.hp).toBe(94)
    expect(heavy).toEqual([true]) // the renderer holds a heavy hit-stop
    expect(b.velocity.x).toBeGreaterThan(400)
    const held = spear.angle
    e.step()
    expect(spear.angle).toBe(held) // held out along the thrust
    for (let i = 0; i < 45 && !events.some((ev) => ev.type === 'wallSlam'); i++) e.step()
    expect(events).toContainEqual(expect.objectContaining({ type: 'wallSlam', ballId: b.id }))
    expect(b.hp).toBe(87)
    expect(b.statusEffects.map((s) => s.defId)).toContain('stun')
  })

  it('the spear is drawn lunging out on a thrust, then back (render-only)', () => {
    const { e, spear } = setup({ x: 200, y: 180 })
    expect(weaponLunge(spear)).toBe(0)
    e.step()
    const reach: number[] = []
    for (let i = 0; i < 25; i++) {
      reach.push(weaponLunge(spear))
      e.step()
    }
    expect(reach[0]).toBeGreaterThan(0) // the tip pierces on contact
    expect(Math.max(...reach)).toBe(18)
    expect(reach.at(-1)).toBe(0)
  })

  it('a hit along the shaft is a plain push, no thrust', () => {
    const { e, b, spear, heavy } = setup({ x: 150, y: 202 })
    e.step()
    expect(b.hp).toBe(94)
    expect(heavy).toEqual([false])
    expect(b.slam).toBeNull()
    const angle = spear.angle
    e.step()
    expect(spear.angle).not.toBe(angle) // still spinning
  })
})
