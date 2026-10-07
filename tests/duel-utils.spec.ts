// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { reactive } from 'vue'
import type { BallConfig } from '~/engine/config'
import { placeForDuel, stepsForElapsed } from '~/utils/duel'

const ball = (id: string, color: string): BallConfig => ({
  id,
  radius: 32,
  maxHp: 100,
  initialPosition: { x: 0, y: 0 },
  initialVelocity: { x: 120, y: 0 },
  weapons: [{ weaponId: 'sword' }],
  appearance: { type: 'color', value: color },
})

describe('placeForDuel', () => {
  const arena = { width: 360, height: 360 }

  it('random starts: same seed → same start; different seeds → different starts', () => {
    const pair = [ball('a', '#e43b44'), ball('b', '#0099db')]
    expect(placeForDuel(pair, arena, 42)).toEqual(placeForDuel(pair, arena, 42))
    const starts = new Set([1, 2, 3, 4, 5].map((s) => JSON.stringify(placeForDuel(pair, arena, s)[0]!.initialPosition)))
    expect(starts.size).toBeGreaterThan(1)
  })

  it('keeps both balls inside the arena, well apart, at the same speed', () => {
    const pair = [ball('a', '#e43b44'), ball('b', '#0099db')]
    for (let seed = 0; seed < 200; seed++) {
      const [a, b] = placeForDuel(pair, arena, seed)
      for (const c of [a!, b!]) {
        expect(c.initialPosition.x).toBeGreaterThanOrEqual(c.radius)
        expect(c.initialPosition.x).toBeLessThanOrEqual(arena.width - c.radius)
        expect(c.initialPosition.y).toBeGreaterThanOrEqual(c.radius)
        expect(c.initialPosition.y).toBeLessThanOrEqual(arena.height - c.radius)
        expect(Math.hypot(c.initialVelocity.x, c.initialVelocity.y)).toBeCloseTo(Math.hypot(180, 90))
      }
      const gap = Math.hypot(a!.initialPosition.x - b!.initialPosition.x, a!.initialPosition.y - b!.initialPosition.y)
      expect(gap).toBeGreaterThanOrEqual(360 * 0.45)
    }
  })

  it('recolors the second ball when both share a color, without mutating input', () => {
    const input = [ball('a', '#FEAE34'), ball('b', '#feae34')]
    const [a, b] = placeForDuel(input, arena, 1)
    expect(a!.appearance).toEqual({ type: 'color', value: '#FEAE34' })
    expect(b!.appearance?.type === 'color' && b!.appearance.value.toLowerCase()).not.toBe('#feae34')
    expect(input[1]!.appearance).toEqual({ type: 'color', value: '#feae34' })
    expect(input[0]!.initialPosition).toEqual({ x: 0, y: 0 }) // input not moved
  })

  it('accepts reactive (Pinia store) configs', () => {
    // Library balls come from a Pinia store as reactive proxies.
    const stored = reactive([ball('a', '#e43b44'), ball('b', '#0099db')])
    const [a] = placeForDuel(stored, arena, 1)
    expect(a!.initialPosition).not.toEqual({ x: 0, y: 0 })
    expect(a!.weapons).toEqual([{ weaponId: 'sword' }])
  })
})

describe('stepsForElapsed (Req 15.7)', () => {
  it('scales the step count by speed, never the timestep', () => {
    expect(stepsForElapsed(1, 1)).toBe(60)
    expect(stepsForElapsed(1, 0.1)).toBe(6)
    expect(stepsForElapsed(1, 10)).toBe(600)
    expect(stepsForElapsed(0, 1)).toBe(0)
  })
})

describe('migrateBalls', () => {
  it('maps the renamed orbiting-blade to shuriken and leaves others alone', async () => {
    const { migrateBalls } = await import('~/stores/library')
    const saved = [
      { id: '1', name: 'old', config: { ...ball('a', '#fff'), weapons: [{ weaponId: 'orbiting-blade' }] } },
      { id: '2', name: 'sword', config: ball('b', '#000') },
    ]
    const [a, b] = migrateBalls(saved)
    expect(a!.config.weapons).toEqual([{ weaponId: 'shuriken' }])
    expect(b).toBe(saved[1])
    expect(saved[0]!.config.weapons).toEqual([{ weaponId: 'orbiting-blade' }]) // input untouched
  })
})
