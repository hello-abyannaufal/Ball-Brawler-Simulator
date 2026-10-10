/**
 * Client-only duel recorder. This file starts with the mime-selection helper
 * (task 19.1); the capture/encode/mix logic is added in task 19.3.
 */

/**
 * Ordered container/codec fallback list, WebM first (Req 14.2). The recorder
 * picks the first entry `MediaRecorder.isTypeSupported` accepts.
 */
export const MIME_FALLBACKS: readonly string[] = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4;codecs=h264,aac',
  'video/mp4',
]

/**
 * Returns the first supported mime type from MIME_FALLBACKS, or null when none
 * are supported (Req 14.2, 14.3). Safe to call where MediaRecorder is absent
 * (returns null).
 */
export function pickMimeType(
  candidates: readonly string[] = MIME_FALLBACKS,
): string | null {
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return null
  }
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return null
}

/** Video bitrate for recordings: enough for 1080×1920 at 60 fps. */
export const VIDEO_BITRATE = 12_000_000

export class RecordingUnsupportedError extends Error {
  constructor() {
    super('Recording is not supported in this browser.')
    this.name = 'RecordingUnsupportedError'
  }
}

export interface Recorder {
  /** Begin capturing the canvas (+ optional audio) at 60 fps (Req 14.1). */
  start(): void
  /** Stop and resolve with the final blob (null if nothing recorded). */
  stop(): Promise<Blob | null>
  readonly mimeType: string
  readonly recording: boolean
}

/**
 * Create a recorder for a canvas, optionally mixing an audio stream so the file
 * has video + audio (Req 14.1, 14.5, 14.6, 14.11). The canvas captures at its
 * internal resolution (the arena/configured resolution), independent of the
 * CSS display size (Req 14.4).
 *
 * Throws `RecordingUnsupportedError` when no mime type is supported, saving no
 * partial recording (Req 14.3).
 */
export function createRecorder(
  canvas: HTMLCanvasElement,
  audioStream?: MediaStream | null,
): Recorder {
  const mimeType = pickMimeType()
  if (!mimeType) {
    throw new RecordingUnsupportedError()
  }

  const stream = canvas.captureStream(60) // Req 14.1
  if (audioStream) {
    for (const track of audioStream.getAudioTracks()) {
      stream.addTrack(track) // mix audio into the recorded stream (Req 14.6)
    }
  }

  const chunks: Blob[] = []
  // Without a bitrate the browser picks a low default (~2.5 Mbps), and the
  // encoder makes large flat areas (the letterbox) flicker at 1080p60.
  const mr = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_BITRATE })
  mr.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  let isRecording = false

  return {
    get mimeType() {
      return mimeType
    },
    get recording() {
      return isRecording
    },
    start() {
      if (isRecording) return
      chunks.length = 0
      mr.start()
      isRecording = true
    },
    stop() {
      return new Promise<Blob | null>((resolve) => {
        if (!isRecording) {
          resolve(null)
          return
        }
        mr.onstop = () => {
          isRecording = false
          resolve(chunks.length ? new Blob(chunks, { type: mimeType }) : null)
        }
        mr.stop()
      })
    },
  }
}
