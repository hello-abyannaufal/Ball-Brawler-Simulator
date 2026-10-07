import { defineStore } from 'pinia'
import { failSafeStorage } from '~/stores/example'
import { putRecordingBlob, deleteRecordingBlob } from '~/utils/recordingsDb'

/** Metadata for a saved recording (the blob itself lives in IndexedDB). */
export interface RecordingMeta {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  durationMs: number
  createdAt: number // epoch ms
}

interface RecordingsState {
  items: RecordingMeta[]
}

let idSeq = 0
function makeId(): string {
  idSeq += 1
  return `rec-${Date.now().toString(36)}-${idSeq}`
}

export const useRecordingsStore = defineStore('recordings', {
  state: (): RecordingsState => ({ items: [] }),

  actions: {
    /**
     * Persist a completed recording: blob to IndexedDB, metadata to the store.
     * On IndexedDB failure, surface the error and create NO metadata entry
     * (Req 14.7, 14.8).
     */
    async addRecording(
      blob: Blob,
      meta: Omit<RecordingMeta, 'id' | 'createdAt' | 'sizeBytes' | 'mimeType'>,
    ): Promise<RecordingMeta> {
      const id = makeId()
      // Store the blob FIRST; if it fails, no metadata is created.
      await putRecordingBlob(id, blob)
      const entry: RecordingMeta = {
        id,
        name: meta.name,
        mimeType: blob.type,
        sizeBytes: blob.size,
        durationMs: meta.durationMs,
        createdAt: Date.now(),
      }
      this.items.unshift(entry)
      return entry
    },

    /**
     * Delete a recording: the blob from IndexedDB first, then its metadata.
     * If the blob can't be deleted, the entry is kept and the error rethrown,
     * so the list never hides a file that still takes up space.
     */
    async removeRecording(id: string): Promise<void> {
      await deleteRecordingBlob(id)
      this.items = this.items.filter((r) => r.id !== id)
    },
  },

  // Only metadata is persisted to localStorage; blobs live in IndexedDB.
  persist: {
    storage: failSafeStorage,
  },
})
