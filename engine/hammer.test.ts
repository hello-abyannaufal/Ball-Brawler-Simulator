import { describe, expect, it } from 'vitest'
import type { Ball, WeaponEntity } from './entities'
import { createEngine, engineVersion } from './engine'
import './weapons'

describe('Hammer heavy blow', () => {
  it('launches the struck ball along the swing of the head, not away from the owner', () => {
    const ball = (id: string, pos: { x: number; y: number }, weapons: { weaponId: string }[]) => ({
      id, radius: 20, maxHp: 100, initialPosition: pos, initialVelocity: { x: 0, y: 0 }, weapons,
    })
    let swing: { x: number; y: number } | null = null
    let away: { x: number; y: number } | null = null
    const e = createEngine({
      seed: 1,
      config: {
        engineVersion, seed: 1, arenaConfig: { width: 360, height: 360 },
        // Target just beside the head's orbit, so it is struck mid-swing.
        ballConfigs: [ball('a', { x: 180, y: 180 }, [{ weaponId: 'hammer' }]), ball('b', { x: 180, y: 260 }, [])],
      },
      onEvent: (ev) => {
        if (ev.type !== 'damage' || swing) return
        const rx = hammer.position.x - a.position.x
        const ry = hammer.position.y - a.position.y
        const len = Math.hypot(rx, ry)
        const spin = Math.sign(hammer.angularSpeed)
        swing = { x: (-ry / len) * spin, y: (rx / len) * spin }
        const d = Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y)
        away = { x: (b.position.x - a.position.x) / d, y: (b.position.y - a.position.y) / d }
      },
    })
    const [a, b] = e.world.entities.filter((x): x is Ball => x.kind === 'ball') as [Ball, Ball]
    const hammer = e.world.entities.find((x): x is WeaponEntity => x.kind === 'weapon')!
    for (let i = 0; i < 300 && !swing; i++) e.step()
    expect(swing).not.toBeNull()
    const v = b.velocity
    const speed = Math.hypot(v.x, v.y)
    expect(speed).toBeCloseTo(540, 0)
    expect((v.x * swing!.x + v.y * swing!.y) / speed).toBeCloseTo(1, 5) // along the swing
    expect(Math.abs(v.x * away!.x + v.y * away!.y) / speed).toBeLessThan(0.9) // not the old radial launch
  })
})
