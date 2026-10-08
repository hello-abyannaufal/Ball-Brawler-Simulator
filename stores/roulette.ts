import { defineStore } from 'pinia'
import { failSafeStorage } from '~/stores/example'

/** Which wheel a weight belongs to. Add kinds here as new wheels arrive. */
export type WheelKind = 'race' | 'weapon'

export const DEFAULT_WEIGHT = 10
export const MAX_WEIGHT = 100

interface RouletteState {
  /** Custom slice weights per wheel, keyed by entry id. Missing = DEFAULT_WEIGHT. */
  weights: Record<WheelKind, Record<string, number>>
  /** Optional wheels the user switched off. Missing = on. */
  disabled: Partial<Record<WheelKind, boolean>>
}

export const useRouletteStore = defineStore('roulette', {
  state: (): RouletteState => ({
    weights: { race: {}, weapon: {} },
    disabled: {},
  }),

  actions: {
    weightOf(kind: WheelKind, id: string): number {
      return this.weights[kind]?.[id] ?? DEFAULT_WEIGHT
    },

    setWeight(kind: WheelKind, id: string, weight: number): void {
      const w = Number.isFinite(weight) ? Math.min(MAX_WEIGHT, Math.max(0, Math.round(weight))) : DEFAULT_WEIGHT
      this.weights[kind] = { ...this.weights[kind], [id]: w }
    },

    resetWeights(kind: WheelKind): void {
      this.weights[kind] = {}
    },

    isEnabled(kind: WheelKind): boolean {
      return !this.disabled?.[kind]
    },

    setEnabled(kind: WheelKind, on: boolean): void {
      this.disabled = { ...this.disabled, [kind]: !on }
    },
  },

  persist: {
    storage: failSafeStorage,
  },
})
