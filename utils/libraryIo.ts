import type { SavedBall, SavedWeapon, SavedDuel } from '~/stores/library'

/** The one JSON document holding the full Library + Settings (Req 13.6). */
export interface ExportDocument {
  version: 1
  library: {
    balls: SavedBall[]
    weapons: SavedWeapon[]
    duels: SavedDuel[]
  }
  settings: Record<string, unknown>
}

/** Build an export document from the two store snapshots. */
export function buildExport(
  library: { balls: SavedBall[]; weapons: SavedWeapon[]; duels: SavedDuel[] },
  settings: Record<string, unknown>,
): ExportDocument {
  return {
    version: 1,
    library: {
      balls: library.balls,
      weapons: library.weapons,
      duels: library.duels,
    },
    settings,
  }
}

/** Serialize an export document to a JSON string. */
export function exportToJson(doc: ExportDocument): string {
  return JSON.stringify(doc, null, 2)
}

/**
 * Parse + validate an import JSON string. Returns the document on success, or
 * `null` when the JSON is invalid or the shape is wrong (Req 13.7, 13.8).
 * Never throws, so callers can leave both stores unchanged on failure.
 */
export function parseImport(json: string): ExportDocument | null {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  if (!isExportDocument(data)) return null
  return data
}

function isArrayOfObjects(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.every((e) => typeof e === 'object' && e !== null)
}

function isExportDocument(v: unknown): v is ExportDocument {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  if (d.version !== 1) return false
  const lib = d.library as Record<string, unknown> | undefined
  if (typeof lib !== 'object' || lib === null) return false
  if (!isArrayOfObjects(lib.balls)) return false
  if (!isArrayOfObjects(lib.weapons)) return false
  if (!isArrayOfObjects(lib.duels)) return false
  if (typeof d.settings !== 'object' || d.settings === null) return false
  return true
}
