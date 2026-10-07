import { defineStore } from 'pinia'
import type { BallConfig, DuelConfig } from '~/engine/config'
import { engineVersion } from '~/engine/engine'
import { failSafeStorage } from '~/stores/example'

/** A saved ball loadout with a unique id. */
export interface SavedBall {
  id: string
  name: string // user-given display name
  config: BallConfig
  /** Roulette seed used for each wheel step that produced this ball (Req 12.7). */
  seeds?: Record<string, number>
}

/** A saved weapon reference with a unique id (config-only; defs live in code). */
export interface SavedWeapon {
  id: string
  weaponId: string
}

/** A saved duel: the storable description of a run (Req 13.9). */
export interface SavedDuel {
  id: string
  duel: DuelConfig
}

interface LibraryState {
  balls: SavedBall[]
  // `skills` is kept as an always-empty array for forward-compat while the
  // skill system is deferred (Requirement 9).
  skills: never[]
  weapons: SavedWeapon[]
  duels: SavedDuel[]
}

let idSeq = 0
function makeId(prefix: string): string {
  idSeq += 1
  return `${prefix}-${Date.now().toString(36)}-${idSeq}`
}

export const useLibraryStore = defineStore('library', {
  state: (): LibraryState => ({
    balls: [],
    skills: [],
    weapons: [],
    duels: [],
  }),

  actions: {
    addBall(config: BallConfig, name: string, seeds?: Record<string, number>): SavedBall {
      const entry: SavedBall = { id: makeId('ball'), name, config, seeds }
      this.balls.push(entry)
      return entry
    },

    removeBall(id: string): void {
      this.balls = this.balls.filter((b) => b.id !== id)
    },

    addWeapon(weaponId: string): SavedWeapon {
      const entry: SavedWeapon = { id: makeId('weapon'), weaponId }
      this.weapons.push(entry)
      return entry
    },

    /**
     * Save a Duel as `{ engineVersion, seed, ballConfigs, arenaConfig }` with
     * `engineVersion` stamped at save time (Req 13.9).
     */
    saveDuel(input: Omit<DuelConfig, 'engineVersion'>): SavedDuel {
      const entry: SavedDuel = {
        id: makeId('duel'),
        duel: { ...input, engineVersion },
      }
      this.duels.push(entry)
      return entry
    },

    /** Replace the entire library state (used by import). */
    replaceAll(next: Partial<LibraryState>): void {
      this.balls = next.balls ?? []
      this.weapons = next.weapons ?? []
      this.duels = next.duels ?? []
      this.skills = []
    },
  },

  // Persisted within 1s of change; on write failure the in-memory state is
  // kept and a persistence error is surfaced (Req 13.2, 13.3). On absent/corrupt
  // load Pinia initialises to the empty state above (Req 13.4, 13.5).
  persist: {
    storage: failSafeStorage,
  },
})
