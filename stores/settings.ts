import { defineStore } from 'pinia'
import { failSafeStorage } from '~/stores/example'

/** Aspect ratios offered in Settings, each with its default resolution. */
export const ASPECT_PRESETS = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '16:9': { width: 1920, height: 1080 },
} as const
export type AspectRatio = keyof typeof ASPECT_PRESETS

export const RESOLUTION_MIN = 1
export const RESOLUTION_MAX = 7680
export const SPEED_MIN = 0.1
export const SPEED_MAX = 10

export interface SettingsState {
  width: number // integer 1–7680 (Req 15.1)
  height: number // integer 1–7680
  aspectRatio: AspectRatio
  sound: boolean
  simulationSpeed: number // 0.1–10.0
}

/** Defaults (Req 15.2): 9:16, 1080×1920, sound on, speed 1.0. */
export function defaultSettings(): SettingsState {
  return { width: 1080, height: 1920, aspectRatio: '9:16', sound: true, simulationSpeed: 1 }
}

function isResolution(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= RESOLUTION_MIN && (v as number) <= RESOLUTION_MAX
}

/**
 * Replace every absent or out-of-bound field with its default (Req 15.5).
 * Pure; never throws, whatever the input.
 */
export function sanitizeSettings(raw: unknown): SettingsState {
  const d = defaultSettings()
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const speed = r.simulationSpeed
  return {
    width: isResolution(r.width) ? r.width : d.width,
    height: isResolution(r.height) ? r.height : d.height,
    aspectRatio:
      typeof r.aspectRatio === 'string' && r.aspectRatio in ASPECT_PRESETS
        ? (r.aspectRatio as AspectRatio)
        : d.aspectRatio,
    sound: typeof r.sound === 'boolean' ? r.sound : d.sound,
    simulationSpeed:
      typeof speed === 'number' && Number.isFinite(speed) && speed >= SPEED_MIN && speed <= SPEED_MAX
        ? speed
        : d.simulationSpeed,
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => defaultSettings(),

  actions: {
    /** Pick an aspect ratio and apply its preset resolution. */
    setAspectRatio(ratio: AspectRatio): void {
      this.aspectRatio = ratio
      this.width = ASPECT_PRESETS[ratio].width
      this.height = ASPECT_PRESETS[ratio].height
    },

    /** Apply a partial update, keeping only in-bound values. */
    update(patch: Partial<SettingsState>): void {
      this.$patch(sanitizeSettings({ ...this.$state, ...patch }))
    },

    reset(): void {
      this.$patch(defaultSettings())
    },
  },

  // Persisted to localStorage on every change (Req 15.3) and restored on load
  // (Req 15.4); restored values are sanitized against their bounds (Req 15.5).
  persist: {
    storage: failSafeStorage,
    afterRestore: (ctx) => {
      ctx.store.$patch((s) => Object.assign(s, sanitizeSettings(s)))
    },
  },
})
