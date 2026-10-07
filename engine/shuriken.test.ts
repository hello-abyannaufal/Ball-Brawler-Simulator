import { describe, it, expect } from 'vitest'
import './weapons/index'
import { createEngine, engineVersion } from './engine'
import type { DuelConfig } from './config'
import type { Projectile, WeaponEntity } from './entities'

const ARENA = { width: 360, height: 360 }

function duel(seed: number): DuelConfig {
  return {
    engineVersion,
    seed,
    arenaConfig: ARENA,
    ballConfigs: [
      { id: 'a', radius: 32, maxHp: 100, initialPosition: { x: 140, y: 180 }, initialVelocity: { x: 180, y: 90 }, weapons: [{ weaponId: 'sword' }] },
      { id: 'b', radius: 32, maxHp: 100, initialPosition: { x: 220, y: 180 }, initialVelocity: { x: -180, y: -90 }, weapons: [{ weaponId: 'shuriken' }] },
    ],
  }
}

describe('Shuriken ring', () => {
  it('one swing cannot wipe the ring: circling shurikens never break on back-to-back steps', () => {
    // Regression: the ring used to re-space after each break, so survivors
    // jumped into the same blade and the whole ring broke in consecutive steps.
    for (let seed = 1; seed <= 5; seed++) {
      const breaks: number[] = []
      const engine = createEngine({
        seed,
        config: duel(seed),
        onEvent: (e) => {
          if (e.type !== 'projectileBlocked') return
          const p = engine.world.entities.find((x): x is Projectile => x.id === e.projectileId && x.kind === 'projectile')
          if (p?.orbiting) breaks.push(engine.world.tick)
        },
      })
      for (let i = 0; i < 2400 && !engine.ended; i++) engine.step()
      expect(breaks.length).toBeGreaterThan(0) // the scenario actually breaks shurikens
      for (let i = 1; i < breaks.length; i++) expect(breaks[i]! - breaks[i - 1]!).toBeGreaterThan(2)
    }
  })

  it('breaking a circling shuriken readies the sword riposte; swatting a thrown one does not', () => {
    // Sword vs Shuriken never clashes (no blade), so circling breaks are the only trigger.
    let circlingBreakSteps = 0
    for (let seed = 1; seed <= 5; seed++) {
      let circling = 0
      let thrown = 0
      const engine = createEngine({
        seed,
        config: duel(seed),
        onEvent: (e) => {
          if (e.type !== 'projectileBlocked') return
          const p = engine.world.entities.find((x): x is Projectile => x.id === e.projectileId && x.kind === 'projectile')
          if (p?.orbiting) circling++
          else if (p) thrown++
        },
      })
      const sword = engine.world.entities.find((x): x is WeaponEntity => x.kind === 'weapon' && x.def.id === 'sword')!
      for (let i = 0; i < 2400 && !engine.ended; i++) {
        circling = 0
        thrown = 0
        const before = sword.riposteSteps
        engine.step()
        if (circling > 0) {
          circlingBreakSteps++
          expect(sword.riposteSteps).toBe(sword.def.riposte!.windowSteps) // readied this step
        } else if (thrown > 0 && before === 0) {
          expect(sword.riposteSteps).toBe(0) // a swat alone does not ready it
        }
      }
    }
    expect(circlingBreakSteps).toBeGreaterThan(0)
  })

  it('keeps circling shurikens on fixed, distinct slots', () => {
    const engine = createEngine({ seed: 1, config: duel(1) })
    for (let i = 0; i < 2400 && !engine.ended; i++) {
      engine.step()
      const ring = engine.world.entities.filter((x): x is Projectile => x.kind === 'projectile' && x.alive && x.orbiting)
      const slots = ring.map((p) => p.orbitSlot)
      expect(new Set(slots).size).toBe(slots.length)
      for (const s of slots) expect(s >= 0 && s < 5).toBe(true)
    }
  })
})
