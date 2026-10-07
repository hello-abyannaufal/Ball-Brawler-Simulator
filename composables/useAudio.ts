/**
 * Client-only retro audio layer (Req 14.5, 14.11, 15.6).
 *
 * All sounds are SYNTHESIZED with the Web Audio API (square/triangle
 * oscillators) — no audio files. The output runs through a gain node that is
 * silenced when the sound setting is disabled, and is also exposed as a
 * MediaStream so the recorder can mix audio into the saved video.
 */

export type SoundEvent = 'hit' | 'clash' | 'win' | 'shoot'

export interface AudioLayer {
  /** Play a one-shot sound for an engine event. No-op while muted. */
  play(event: SoundEvent): void
  /** Enable/disable all sound (Req 15.6). */
  setEnabled(enabled: boolean): void
  /** An audio MediaStream to mix into a recording, or null if unavailable. */
  getStream(): MediaStream | null
  /** Release the AudioContext and nodes. */
  dispose(): void
}

export function useAudio(initialEnabled = true): AudioLayer {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let dest: MediaStreamAudioDestinationNode | null = null
  let enabled = initialEnabled

  function ensure(): boolean {
    if (typeof window === 'undefined') return false
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return false
    if (!ctx) {
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = enabled ? 0.3 : 0
      master.connect(ctx.destination)
      // Separate tap for recording so the file also gets audio (Req 14.5).
      dest = ctx.createMediaStreamDestination()
      master.connect(dest)
    }
    return true
  }

  /** One oscillator blip with a short decay envelope. */
  function blip(
    type: OscillatorType,
    freq: number,
    start: number,
    dur: number,
    peak = 1,
  ): void {
    if (!ctx || !master) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(peak, start + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(g)
    g.connect(master)
    osc.start(start)
    osc.stop(start + dur + 0.02)
  }

  function play(event: SoundEvent): void {
    if (!enabled || !ensure() || !ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime
    switch (event) {
      case 'hit':
        blip('square', 180, t, 0.08)
        break
      case 'shoot':
        blip('triangle', 520, t, 0.06)
        break
      case 'clash':
        blip('square', 420, t, 0.05)
        blip('square', 300, t + 0.04, 0.07)
        break
      case 'win':
        // rising three-note jingle
        blip('square', 523, t, 0.12)
        blip('square', 659, t + 0.12, 0.12)
        blip('square', 784, t + 0.24, 0.2)
        break
    }
  }

  function setEnabled(next: boolean): void {
    enabled = next
    if (master) master.gain.value = next ? 0.3 : 0
  }

  function getStream(): MediaStream | null {
    if (!ensure()) return null
    return dest ? dest.stream : null
  }

  function dispose(): void {
    void ctx?.close()
    ctx = null
    master = null
    dest = null
  }

  return { play, setEnabled, getStream, dispose }
}
