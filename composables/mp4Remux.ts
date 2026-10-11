/**
 * Turn a MediaRecorder MP4 into one phones and TikTok accept. Chrome writes a
 * fragmented MP4, and where it has no AAC encoder (Linux) the audio is Opus,
 * which phone players drop and TikTok rejects ("Can't decode video"). The
 * H.264 video is copied untouched; only the audio is re-encoded to AAC, and the
 * index goes to the front (+faststart).
 *
 * ffmpeg.wasm (~30 MB) is loaded lazily on first use and reused after.
 */
import type { FFmpeg } from '@ffmpeg/ffmpeg'

let ffmpegPromise: Promise<FFmpeg> | null = null

function loadFFmpeg(): Promise<FFmpeg> {
  ffmpegPromise ??= (async () => {
    const [{ FFmpeg }, { default: coreURL }, { default: wasmURL }] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      import('@ffmpeg/core?url'),
      import('@ffmpeg/core/wasm?url'),
    ])
    const ffmpeg = new FFmpeg()
    await ffmpeg.load({ coreURL, wasmURL })
    return ffmpeg
  })().catch((err) => {
    ffmpegPromise = null // allow a retry on the next recording
    throw err
  })
  return ffmpegPromise
}

export async function remuxMp4(blob: Blob): Promise<Blob> {
  const ffmpeg = await loadFFmpeg()
  await ffmpeg.writeFile('in.mp4', new Uint8Array(await blob.arrayBuffer()))
  try {
    const code = await ffmpeg.exec([
      '-i', 'in.mp4',
      '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      'out.mp4',
    ])
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`)
    const data = (await ffmpeg.readFile('out.mp4')) as Uint8Array<ArrayBuffer>
    return new Blob([data], { type: 'video/mp4' })
  } finally {
    await ffmpeg.deleteFile('in.mp4').catch(() => {})
    await ffmpeg.deleteFile('out.mp4').catch(() => {})
  }
}
