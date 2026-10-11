/**
 * Client-only retro audio layer (Req 14.5, 14.11, 15.6).
 *
 * All sounds are SYNTHESIZED with the Web Audio API, sfxr-style: square /
 * triangle tones with pitch sweeps plus filtered noise bursts, slightly
 * detuned on every play so repeats don't drone. No audio files. The output
 * runs through a compressor and a gain node that is silenced when the sound
 * setting is disabled, and is also exposed as a MediaStream so the recorder
 * can mix audio into the saved video.
 */

export type SoundEvent =
  | 'hit' // blade
  | 'hitHeavy' // Hammer, Spear thrust
  | 'hitCrit' // riposte, spear tip
  | 'hitProjectile'
  | 'hitDot' // poison tick
  | 'slam' // wall slam
  | 'parry' | 'bounce' | 'disarm' // weapon clash outcomes
  | 'deflect' // projectile blocked / projectiles collided
  | 'reflect' // projectile sent back by a riposte
  | 'shootArrow' | 'shootBullet'
  | 'poison' | 'slow' | 'stun' // status applied
  | 'death' // the losing ball starts blinking
  | 'shatter' // ... and breaks apart
  | 'win' | 'draw'
  | 'countdown' | 'fight' // intro: 3-2-1 ticks, then the start

export interface AudioLayer {
  /** Play a one-shot sound. No-op while muted. */
  play(event: SoundEvent): void
  /** Enable/disable all sound (Req 15.6). */
  setEnabled(enabled: boolean): void
  /** An audio MediaStream to mix into a recording, or null if unavailable. */
  getStream(): MediaStream | null
  /** Release the AudioContext and nodes. */
  dispose(): void
}

const VOLUME = 0.3
/** Same sound again within this many seconds is dropped (Revolver bursts,
 *  several hits in one step), so stacked copies don't clip. */
const MIN_GAP = 0.03
/** Random pitch spread per play, ± this fraction. */
const DETUNE = 0.06

interface NoiseOpts {
  filter: BiquadFilterType
  freq: number
  freqEnd?: number
  q?: number
}

export function useAudio(initialEnabled = true): AudioLayer {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let dest: MediaStreamAudioDestinationNode | null = null
  let noiseBuf: AudioBuffer | null = null
  let input: AudioNode | null = null // compressor in front of master
  let enabled = initialEnabled
  const lastPlayed = new Map<SoundEvent, number>()

  function ensure(): boolean {
    if (typeof window === 'undefined') return false
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return false
    if (!ctx) {
      ctx = new AC()
      // Many sounds can overlap (a burst, a death): even them out.
      const comp = ctx.createDynamicsCompressor()
      master = ctx.createGain()
      master.gain.value = enabled ? VOLUME : 0
      comp.connect(master)
      master.connect(ctx.destination)
      // Separate tap for recording so the file also gets audio (Req 14.5).
      dest = ctx.createMediaStreamDestination()
      master.connect(dest)
      // With no sound playing, Chrome stops feeding the stream, and the MP4
      // recorder leaves a gap in the audio track: phones then play the audio
      // ahead of the video. A source outputting silence keeps it continuous.
      const keepAlive = ctx.createConstantSource()
      keepAlive.offset.value = 0
      keepAlive.connect(dest)
      keepAlive.start()
      // One second of white noise, shared by every noise burst.
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const d = noiseBuf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      input = comp
    }
    return true
  }

  /** A gain envelope: 5 ms attack to `peak`, exponential decay over `dur`. */
  function envelope(start: number, dur: number, peak: number): GainNode {
    const g = ctx!.createGain()
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(peak, start + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    g.connect(input!)
    return g
  }

  /** One oscillator note, its pitch sweeping from `f0` to `f1`. */
  function tone(type: OscillatorType, f0: number, f1: number, start: number, dur: number, peak: number): void {
    const osc = ctx!.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(f0, start)
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, start + dur)
    osc.connect(envelope(start, dur, peak))
    osc.start(start)
    osc.stop(start + dur + 0.02)
  }

  /** A filtered noise burst; the filter can sweep (whoosh, crunch). */
  function noise(start: number, dur: number, peak: number, o: NoiseOpts): void {
    const src = ctx!.createBufferSource()
    src.buffer = noiseBuf
    const f = ctx!.createBiquadFilter()
    f.type = o.filter
    f.Q.value = o.q ?? 1
    f.frequency.setValueAtTime(o.freq, start)
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, start + dur)
    src.connect(f)
    f.connect(envelope(start, dur, peak))
    src.start(start, Math.random() * 0.5) // random slice of the buffer
    src.stop(start + dur + 0.02)
  }

  /** Metal ring: inharmonic partials (a struck bar, 1 : 2.76 : 5.4), each a
   *  slightly detuned pair so it shimmers, gliding a touch flat as it decays. */
  function ring(f: number, start: number, dur: number, peak: number): void {
    const partials: Array<[number, number, number]> = [[1, 1, 1], [2.76, 0.45, 0.7], [5.4, 0.2, 0.45]] // ratio, level, length
    for (const [ratio, level, length] of partials) {
      for (const beat of [1, 1.007]) {
        const hz = f * ratio * beat
        tone('sine', hz, hz * 0.985, start, dur * length, peak * level * 0.5)
      }
    }
  }

  /** The "sr" of a scrape: bright noise sweeping down. */
  function scrape(start: number, dur: number, peak: number, from: number, to: number): void {
    noise(start, dur, peak, { filter: 'bandpass', freq: from, freqEnd: to, q: 4 })
  }

  function play(event: SoundEvent): void {
    if (!enabled || !ensure() || !ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime
    if (t - (lastPlayed.get(event) ?? -1) < MIN_GAP) return
    lastPlayed.set(event, t)
    const p = 1 + (Math.random() * 2 - 1) * DETUNE // pitch factor for this play
    switch (event) {
      case 'hit': // slash: hiss + a snappy downward blip
        noise(t, 0.07, 0.5, { filter: 'highpass', freq: 2500 * p })
        tone('square', 320 * p, 110 * p, t, 0.08, 0.3)
        break
      case 'hitHeavy': // thump: low noise + a dropping body
        noise(t, 0.18, 0.9, { filter: 'lowpass', freq: 1200 * p, freqEnd: 150 })
        tone('triangle', 150 * p, 45 * p, t, 0.2, 0.9)
        tone('square', 90 * p, 40 * p, t, 0.1, 0.25)
        break
      case 'hitCrit': // the slash plus a bright metallic ring
        noise(t, 0.08, 0.6, { filter: 'highpass', freq: 3000 * p })
        tone('square', 380 * p, 120 * p, t, 0.09, 0.3)
        tone('square', 1320 * p, 1320 * p, t + 0.01, 0.16, 0.12)
        tone('square', 1980 * p, 1980 * p, t + 0.01, 0.12, 0.08)
        break
      case 'hitProjectile': // short tick-thud
        noise(t, 0.05, 0.45, { filter: 'bandpass', freq: 1400 * p, q: 2 })
        tone('square', 260 * p, 130 * p, t, 0.05, 0.22)
        break
      case 'hitDot': // a soft bubble pop
        tone('triangle', 320 * p, 240 * p, t, 0.05, 0.18)
        break
      case 'slam': // boom against the wall
        noise(t, 0.4, 1, { filter: 'lowpass', freq: 700 * p, freqEnd: 60 })
        tone('triangle', 100 * p, 32 * p, t, 0.35, 1)
        break
      case 'parry': // "sriiing": blade on blade, long bright ring
        scrape(t, 0.14, 0.55, 9000 * p, 3500 * p)
        tone('square', 1500 * p, 1200 * p, t, 0.03, 0.12) // the strike
        ring(1250 * p, t + 0.01, 0.55, 0.5)
        break
      case 'bounce': // "sring": shorter and lower
        scrape(t, 0.09, 0.45, 7000 * p, 3000 * p)
        tone('square', 900 * p, 700 * p, t, 0.03, 0.12)
        ring(900 * p, t + 0.01, 0.32, 0.45)
        break
      case 'disarm': // heavy "SRANG", then the weapon clattering off
        scrape(t, 0.18, 0.7, 8000 * p, 1500 * p)
        noise(t, 0.08, 0.5, { filter: 'lowpass', freq: 1500 })
        ring(700 * p, t + 0.01, 0.45, 0.55)
        tone('square', 760 * p, 180 * p, t + 0.05, 0.28, 0.12)
        break
      case 'deflect':
        noise(t, 0.02, 0.2, { filter: 'highpass', freq: 6000 })
        tone('square', 1700 * p, 1400 * p, t, 0.05, 0.12)
        break
      case 'reflect': // rising zing
        tone('square', 600 * p, 1900 * p, t, 0.12, 0.18)
        noise(t, 0.08, 0.2, { filter: 'highpass', freq: 4000 })
        break
      case 'shootArrow': // twang + whoosh
        tone('triangle', 900 * p, 480 * p, t, 0.05, 0.12)
        noise(t, 0.1, 0.25, { filter: 'bandpass', freq: 2000 * p, freqEnd: 600, q: 1.5 })
        break
      case 'shootBullet': // pop
        noise(t, 0.05, 0.5, { filter: 'lowpass', freq: 3500 * p, freqEnd: 500 })
        tone('square', 220 * p, 60 * p, t, 0.05, 0.22)
        break
      case 'poison': // two rising bubbles
        tone('triangle', 420 * p, 620 * p, t, 0.06, 0.16)
        tone('triangle', 520 * p, 780 * p, t + 0.07, 0.06, 0.14)
        break
      case 'slow': // a sinking whistle
        tone('triangle', 560 * p, 240 * p, t, 0.18, 0.18)
        break
      case 'stun': // birdies
        for (let i = 0; i < 3; i++) tone('square', (i % 2 ? 1100 : 880) * p, (i % 2 ? 1100 : 880) * p, t + i * 0.05, 0.04, 0.1)
        break
      case 'death': // power-down
        tone('square', 440, 55, t, 0.42, 0.25)
        tone('triangle', 220, 40, t, 0.45, 0.35)
        break
      case 'shatter': // crunch + glassy tinkle
        noise(t, 0.3, 0.8, { filter: 'highpass', freq: 1500 })
        noise(t, 0.4, 0.6, { filter: 'lowpass', freq: 900, freqEnd: 100 })
        for (let i = 0; i < 5; i++) {
          const f = 1500 + Math.random() * 1800
          tone('square', f, f, t + Math.random() * 0.18, 0.05, 0.07)
        }
        break
      case 'win': { // rising arpeggio over a bass note
        const notes = [523, 659, 784, 1047]
        notes.forEach((f, i) => tone('square', f, f, t + i * 0.1, i === notes.length - 1 ? 0.35 : 0.1, 0.22))
        tone('triangle', 131, 131, t, 0.65, 0.4)
        break
      }
      case 'countdown': // short arcade tick
        tone('square', 660, 660, t, 0.12, 0.22)
        break
      case 'fight': // higher, longer tick over a punch
        tone('square', 1320, 1320, t, 0.3, 0.22)
        tone('triangle', 165, 82, t, 0.3, 0.5)
        noise(t, 0.15, 0.4, { filter: 'lowpass', freq: 1500, freqEnd: 200 })
        break
      case 'draw': // a flat, falling pair
        tone('square', 392, 392, t, 0.18, 0.2)
        tone('square', 370, 370, t + 0.2, 0.3, 0.2)
        tone('triangle', 98, 98, t, 0.5, 0.35)
        break
    }
  }

  function setEnabled(next: boolean): void {
    enabled = next
    if (master) master.gain.value = next ? VOLUME : 0
  }

  function getStream(): MediaStream | null {
    if (!ensure()) return null
    return dest ? dest.stream : null
  }

  function dispose(): void {
    void ctx?.close()
    ctx = null
    master = null
    input = null
    dest = null
    noiseBuf = null
  }

  return { play, setEnabled, getStream, dispose }
}
