import { describe, expect, it } from 'vitest'
import type { Ball, WeaponEntity } from './entities'
import type { BehaviorContext, HitResponse } from './weapons/behavior'
import { riposte } from './weapons/behaviors/riposte'

const r = riposte({ multiplier: 2, windowSteps: 60, launchSpeed: 420 })
const foe = { position: { x: 100, y: 0 } } as Ball
const ctx = {
  weapon: { angle: 0, angularSpeed: 4, def: { angularSpeed: 4 } } as unknown as WeaponEntity,
  owner: { position: { x: 0, y: 0 } } as Ball,
  nearestOpponent: () => foe,
} as unknown as BehaviorContext
const hit = (): HitResponse => ({ cooldownSteps: 30, knockback: 'push' })

describe('Sword riposte', () => {
  it('is readied by a clash it lost (disarmed) too', () => {
    const s = r.init()
    r.onClash!(ctx, s, false)
    expect(r.active!(s)).toBe(true)
  })

  it('the boosted hit deals ×2 and launches the ball, without a wall slam; the next hit is plain', () => {
    const s = r.init()
    r.onClash!(ctx, s, true)
    expect(r.hitMultiplier!(ctx, s, foe)).toBe(2)
    const boosted = hit()
    r.afterHit!(ctx, s, foe, boosted)
    expect(boosted.knockback).toEqual({ launchSpeed: 420 })
    expect(boosted.wallSlam).toBeUndefined()

    expect(r.hitMultiplier!(ctx, s, foe)).toBe(1)
    const plain = hit()
    r.afterHit!(ctx, s, foe, plain)
    expect(plain.knockback).toBe('push')
  })
})
