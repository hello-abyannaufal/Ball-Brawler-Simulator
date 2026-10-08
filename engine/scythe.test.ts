import { describe, it, expect } from 'vitest'
import './weapons/index'
import { createEngine, engineVersion, TIMESTEP } from './engine'
import type { DuelConfig } from './config'
import type { WeaponEntity } from './entities'

const ARENA = { width: 360, height: 360 }

function duel(seed: number, foe: string): DuelConfig {
  return {
    engineVersion,
    seed,
    arenaConfig: ARENA,
    ballConfigs: [
      { id: 'a', radius: 32, maxHp: 100, initialPosition: { x: 140, y: 180 }, initialVelocity: { x: 180, y: 90 }, weapons: [{ weaponId: 'scythe' }] },
      { id: 'b', radius: 32, maxHp: 100, initialPosition: { x: 220, y: 180 }, initialVelocity: { x: -180, y: -90 }, weapons: [{ weaponId: foe }] },
    ],
  }
}

describe('Scythe reap', () => {
  it('a hit starts a reap that cuts the same ball again, then waits out the full cooldown', () => {
    let multiHitReaps = 0
    for (let seed = 1; seed <= 5; seed++) {
      for (const foe of ['sword', 'hammer', 'bow']) {
        let hit = false
        const engine = createEngine({
          seed,
          config: duel(seed, foe),
          onEvent: (e) => {
            if (e.type === 'damage' && e.source.tag === 'weapon' && e.attackerId === scytheOwner) hit = true
          },
        })
        const scythe = engine.world.entities.find((x): x is WeaponEntity => x.kind === 'weapon' && x.def.id === 'scythe')!
        const scytheOwner = scythe.ownerId
        const reap = scythe.def.reap!
        const full = Math.round(scythe.def.hitCooldown / 1000 / TIMESTEP)
        let hitsThisReap = 0
        let reapEndedAt = -Infinity
        for (let i = 0; i < 3600 && !engine.ended; i++) {
          hit = false
          const before = scythe.reapSteps
          engine.step()
          if (!hit) {
            if (before > 0 && scythe.reapSteps === 0) {
              if (hitsThisReap >= 2) multiHitReaps++
              reapEndedAt = engine.world.tick
            }
            continue
          }
          if (before === 0) {
            // A fresh reap: never right after the last one ended.
            expect(engine.world.tick - reapEndedAt).toBeGreaterThanOrEqual(full)
            expect(scythe.reapSteps).toBe(reap.windowSteps)
            hitsThisReap = 1
          } else {
            hitsThisReap++
          }
        }
      }
    }
    expect(multiHitReaps).toBeGreaterThan(0)
  })
})
