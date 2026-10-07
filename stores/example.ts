import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * REMOVABLE example store. Exists only to prove Pinia + persistence wiring in
 * Phase 1. Delete once a real persisted store replaces it.
 */

export interface PersistenceError {
  failed: boolean
  message: string
}

// Module-scoped reactive signal so the layout can surface a persistence
// failure without depending on an active Pinia instance inside the storage
// adapter (Req 5.5).
const persistenceError = ref<PersistenceError>({ failed: false, message: '' })

export function usePersistenceError() {
  return persistenceError
}

/**
 * localStorage adapter that preserves in-memory state on a failed write and
 * raises the persistence-error signal. Exported for direct testing.
 */
export const failSafeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
      if (persistenceError.value.failed) {
        persistenceError.value = { failed: false, message: '' }
      }
    } catch (error) {
      const message
        = error instanceof Error ? error.message : 'Unknown storage error'
      persistenceError.value = {
        failed: true,
        message: `Failed to persist state: ${message}`,
      }
    }
  },
}

interface ExampleState {
  visitCount: number
}

export const useExampleStore = defineStore('example', {
  state: (): ExampleState => ({
    visitCount: 0,
  }),
  actions: {
    increment() {
      this.visitCount += 1
    },
  },
  persist: {
    storage: failSafeStorage,
  },
})
