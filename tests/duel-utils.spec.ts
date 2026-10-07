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

  it('puts the pair in mirrored left/right start slots', () => {
    const [a, b] = placeForDuel([ball('a', '#e43b44'), ball('b', '#0099db')], arena)
    expect(a!.initialPosition).toEqual({ x: 140, y: 180 })
    expect(b!.initialPosition).toEqual({ x: 220, y: 180 })
    expect(b!.initialVelocity).toEqual({ x: -a!.initialVelocity.x, y: -a!.initialVelocity.y })
  })

  it('recolors the second ball when both share a color, without mutating input', () => {
    const input = [ball('a', '#FEAE34'), ball('b', '#feae34')]
    const [a, b] = placeForDuel(input, arena)
    expect(a!.appearance).toEqual({ type: 'color', value: '#FEAE34' })
    expect(b!.appearance?.type === 'color' && b!.appearance.value.toLowerCase()).not.toBe('#feae34')
    expect(input[1]!.appearance).toEqual({ type: 'color', value: '#feae34' })
    expect(input[0]!.initialPosition).toEqual({ x: 0, y: 0 })
  })

  it('accepts reactive (Pinia store) configs', () => {
    // Library balls come from a Pinia store as reactive proxies.
    const stored = reactive([ball('a', '#e43b44'), ball('b', '#0099db')])
    const [a] = placeForDuel(stored, arena)
    expect(a!.initialPosition).toEqual({ x: 140, y: 180 })
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
