/**
 * Client-only IndexedDB helper for recording blobs, keyed by recording id
 * (Req 14.7, 14.8). Metadata lives in the Pinia recordings store; the heavy
 * blob lives here.
 */

const DB_NAME = 'ballbrawler'
const STORE = 'recordings'
const VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available.'))
      return
    }
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB.'))
  })
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed.'))
        t.oncomplete = () => db.close()
      }),
  )
}

/** Store a blob under the recording id. Rejects on failure (Req 14.8). */
export function putRecordingBlob(id: string, blob: Blob): Promise<void> {
  return tx('readwrite', (s) => s.put(blob, id)).then(() => undefined)
}

/** Read a recording blob, or null when absent. */
export function getRecordingBlob(id: string): Promise<Blob | null> {
  return tx<Blob | undefined>('readonly', (s) => s.get(id)).then(
    (b) => b ?? null,
  )
}

/** Delete a recording blob. */
export function deleteRecordingBlob(id: string): Promise<void> {
  return tx('readwrite', (s) => s.delete(id)).then(() => undefined)
}
