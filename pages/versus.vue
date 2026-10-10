<script setup lang="ts">
import { ref, computed, watch, watchEffect, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type { BallConfig, DuelConfig } from '~/engine/config'
import { engineVersion } from '~/engine/engine'
import { SEED_MAX } from '~/engine/rng'
import { useVersusDuel, type VersusDuel } from '~/composables/useVersusDuel'
import { useAudio } from '~/composables/useAudio'
import { createRecorder, RecordingUnsupportedError, type Recorder } from '~/composables/useRecorder'
import { useRecordingsStore } from '~/stores/recordings'
import { useSettingsStore } from '~/stores/settings'
import { useLibraryStore } from '~/stores/library'
import { weaponRegistry } from '~/engine/weapons/registry'
import { raceRegistry } from '~/engine/races/registry'
import { defaultBalls, placeForDuel } from '~/utils/duel'
import { BALL_DEFAULT_FILL } from '~/utils/pixelBall'
import { spriteSource } from '~/assets/sprites/manifest'
import '~/engine/weapons/index' // populate the registry
import '~/engine/races/index'

definePageMeta({ middleware: 'auth' })

// Arena configured into a Duel_Config before running (Req 11.4).
const arena = { width: 360, height: 360 } // 1:1
// A fresh seed per Start and per Rematch, so every duel starts from new positions.
const seed = ref(0)

interface Candidate {
  key: string // unique across sources
  name: string
  source: 'default' | 'library'
  config: BallConfig
  usable: boolean // false if it references a weapon or race this build doesn't have
}

// Candidate balls: the built-in defaults plus everything saved in the Library
// (e.g. from Roulette) (Req 11.1).
const library = useLibraryStore()
const candidates = computed<Candidate[]>(() => {
  const usable = (c: BallConfig) =>
    c.weapons.every((w) => weaponRegistry.has(w.weaponId)) && (c.raceId === undefined || raceRegistry.has(c.raceId))
  return [
    ...defaultBalls().map((c) => ({
      key: `default:${c.id}`,
      name: weaponRegistry.get(c.weapons[0]!.weaponId)?.name ?? c.id,
      source: 'default' as const,
      config: c,
      usable: true,
    })),
    ...library.balls.map((b) => ({
      key: `library:${b.id}`,
      name: b.name || b.config.id,
      source: 'library' as const,
      config: b.config,
      usable: usable(b.config),
    })),
  ]
})
// Selection order = start slot (first = left, second = right).
const selectedIds = ref<string[]>(defaultBalls().slice(0, 2).map((c) => `default:${c.id}`))

const selected = computed(() =>
  selectedIds.value
    .map((key) => candidates.value.find((c) => c.key === key))
    .filter((c): c is Candidate => !!c && c.usable),
)
const canStart = computed(() => selected.value.length === 2) // exactly two (Req 11.1, 11.2)
// Names of the balls in the running duel, in engine order (HP bars, winner).
const duelNames = ref<string[]>([])
const winnerName = computed(() => {
  if (winner.value === undefined || winner.value === null) return null
  const i = hp.value.findIndex((h) => h.id === winner.value)
  return duelNames.value[i] ?? `Ball ${winner.value}`
})

const canvasEl = ref<HTMLCanvasElement | null>(null)
const running = ref(false)
const showHitboxes = ref(false)
let duel: VersusDuel | null = null

const hp = ref<{ id: number; hp: number; maxHp: number }[]>([])
const winner = ref<number | null | undefined>(undefined)

// Sound, simulation speed, and output resolution come from Settings (Req 15).
const settings = useSettingsStore()
const soundEnabled = computed({
  get: () => settings.sound,
  set: (v: boolean) => settings.update({ sound: v }),
})
const prefersReducedMotion
  = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
// Canvas is drawn at the configured resolution; CSS only scales it to fit.
const canvasStyle = computed(() => ({
  aspectRatio: `${settings.width} / ${settings.height}`,
  maxWidth: `min(480px, calc(75vh * ${settings.width / settings.height}))`,
  imageRendering: 'pixelated' as const,
}))
const audio = useAudio(soundEnabled.value)
const recordings = useRecordingsStore()
const autoRecording = ref(false)
const recError = ref('')
let recorder: Recorder | null = null
let recStart = 0

watch(soundEnabled, (v) => audio.setEnabled(v))

// Weapon sprites carry transparent padding (the shuriken is ~14px in a 32px
// canvas), so icons are cropped to their visible pixels and then scaled to fit.
const croppedIcons = ref<Record<string, string>>({})

function cropToContent(src: string): void {
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, c.width, c.height)
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (data[(y * c.width + x) * 4 + 3]! === 0) continue
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
      }
    }
    if (x1 < 0) return
    const out = document.createElement('canvas')
    out.width = x1 - x0 + 1
    out.height = y1 - y0 + 1
    out.getContext('2d')?.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
    croppedIcons.value = { ...croppedIcons.value, [src]: out.toDataURL() }
  }
  img.src = src
}

/** Cropped image of a ball's first weapon sprite, or null to fall back to the color dot. */
function weaponIcon(c: BallConfig): string | null {
  const spriteId = weaponRegistry.get(c.weapons[0]?.weaponId ?? '')?.spriteId
  const src = spriteId ? spriteSource(spriteId) : null
  if (src?.kind !== 'image') return null
  return croppedIcons.value[src.src] ?? src.src // uncropped until onMounted finishes
}

function ballFill(c: BallConfig): string {
  return c.appearance?.type === 'color' ? c.appearance.value : BALL_DEFAULT_FILL
}

/** "Race · HP" line for a fighter card; the race supplies HP when set. */
function statsLine(c: BallConfig): string {
  const race = c.raceId !== undefined ? raceRegistry.get(c.raceId) : undefined
  const hp = race?.maxHp || c.maxHp
  return race ? `${race.name} · ${hp}` : `HP ${hp}`
}

/** "P1" / "P2" for selected fighters, in pick order. */
function slotLabel(key: string): string {
  const i = selected.value.findIndex((c) => c.key === key)
  return i >= 0 ? `P${i + 1}` : ''
}

onMounted(() => {
  for (const id of weaponRegistry.ids()) {
    const spriteId = weaponRegistry.get(id)?.spriteId
    const src = spriteId ? spriteSource(spriteId) : null
    if (src?.kind === 'image') cropToContent(src.src)
  }
})

function toggle(id: string): void {
  const i = selectedIds.value.indexOf(id)
  if (i >= 0) selectedIds.value.splice(i, 1)
  else selectedIds.value.push(id)
}

/** A duel config with a fresh seed and the start positions it derives. */
function newDuelConfig(): DuelConfig {
  seed.value = Math.floor(Math.random() * (SEED_MAX + 1)) // UI-side randomness; the engine stays seeded
  return {
    engineVersion,
    seed: seed.value,
    // Random, well-separated starts derived from the seed (any pair, default or Library).
    ballConfigs: placeForDuel(selected.value.map((c) => c.config), arena, seed.value),
    arenaConfig: arena,
  }
}

let stopDuelWatchers: (() => void) | null = null

/** Stop the running duel: its loop, its sounds and its HP/winner mirror. */
function stopDuel(): void {
  stopDuelWatchers?.()
  stopDuelWatchers = null
  duel?.dispose()
  duel = null
}

/** Back to the picker. The duel stops for real. A recording of a finished duel
 *  is still saved by the pending winner timeout; one cut off mid-fight is dropped. */
function backToPicker(): void {
  const finished = winner.value !== undefined
  stopDuel()
  if (recorder && !finished) {
    void recorder.stop()
    recorder = null
    autoRecording.value = false
  }
  winner.value = undefined
  running.value = false
}

function startDuel(record = false): void {
  if (!canStart.value) return
  recError.value = ''
  const config = newDuelConfig()
  duelNames.value = selected.value.map((c) => c.name)
  stopDuel()
  duel = useVersusDuel(canvasEl, config, seed.value, settings.simulationSpeed, {
    showHitboxes: showHitboxes.value,
    reducedMotion: prefersReducedMotion,
    names: duelNames.value,
  })
  // Mirror the shallowRefs into local reactive refs for the template.
  const stopMirror = watchEffect(() => {
    hp.value = duel!.view.hp.value
    winner.value = duel!.view.winner.value
  })
  // Play a synthesized sound per engine event (Req 14.5).
  const stopSounds = watch(
    () => duel!.view.lastEvent.value,
    (e) => {
      if (!e) return
      if (e.type === 'damage') audio.play('hit')
      else if (e.type === 'weaponClash' || e.type === 'projectileBlocked' || e.type === 'projectileReflected') audio.play('clash')
      else if (e.type === 'matchEnded') audio.play('win')
    },
  )
  stopDuelWatchers = () => {
    stopMirror()
    stopSounds()
  }
  running.value = true
  duel.start()

  // The canvas only mounts once `running` flips, so wait a tick before
  // capturing it (otherwise the first recording silently never starts).
  if (record) void nextTick().then(startAutoRecord)
}

function startAutoRecord(): void {
  const canvas = canvasEl.value
  if (!canvas) {
    recError.value = 'Could not start recording: canvas not ready.'
    return
  }
  try {
    recorder = createRecorder(canvas, audio.getStream()) // mix audio (Req 14.6)
  } catch (err) {
    recError.value =
      err instanceof RecordingUnsupportedError
        ? err.message
        : 'Could not start recording.'
    recorder = null
    return
  }
  autoRecording.value = true
  recStart = performance.now()
  recorder.start()
}

// Stop recording 3s after a winner is determined (time to read the result card), then save.
watch(winner, (w) => {
  if (w === undefined || !recorder || !autoRecording.value) return
  window.setTimeout(() => void finishRecording(), 3000)
})

async function finishRecording(): Promise<void> {
  if (!recorder) return
  const durationMs = Math.round(performance.now() - recStart)
  const blob = await recorder.stop()
  recorder = null
  autoRecording.value = false
  if (!blob) return
  try {
    await recordings.addRecording(blob, {
      name: `Duel ${new Date().toLocaleString()}`,
      durationMs,
    })
  } catch {
    recError.value = 'Recording could not be saved.' // Req 14.8
  }
}

function rematch(): void {
  duel?.rematch(newDuelConfig())
}

onBeforeUnmount(() => {
  stopDuel() // Req 11.11
  void recorder?.stop()
  recorder = null
  audio.dispose()
})
</script>

<template>
  <PixelPage title="Versus">
    <div v-if="!running" class="flex flex-wrap items-start gap-9">
      <section aria-labelledby="pick-title" class="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="pick-title" class="font-pixel text-xs text-edg-sand">
            CHOOSE 2 FIGHTERS
          </h2>
          <span class="text-[22px] text-edg-fog">{{ selected.length }} / 2 selected</span>
        </div>

        <ul class="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-[22px]">
          <li v-for="b in candidates" :key="b.key" class="flex">
            <button
              type="button"
              :aria-pressed="selectedIds.includes(b.key)"
              :disabled="!b.usable"
              class="relative flex grow flex-col items-center gap-1.5 px-2.5 pb-3.5 pt-4 text-center"
              :class="selectedIds.includes(b.key) && b.usable ? 'px-selected' : 'px-btn-slate'"
              @click="toggle(b.key)"
            >
              <span
                v-if="slotLabel(b.key)"
                class="absolute -left-2.5 -top-2.5 bg-edg-gold px-1.5 py-1.5 font-pixel text-[10px] text-edg-ink shadow-[0_0_0_4px_#181425]"
              >{{ slotLabel(b.key) }}</span>
              <span class="relative block h-16 w-24" aria-hidden="true">
                <PixelBall :fill="ballFill(b.config)" class="absolute left-1 top-1 size-14" />
                <img
                  v-if="weaponIcon(b.config)"
                  :src="weaponIcon(b.config)!"
                  alt=""
                  class="absolute right-0 top-4 size-12 -rotate-45 object-contain [image-rendering:pixelated]"
                >
              </span>
              <span class="font-pixel text-[11px] leading-snug">{{ b.name }}</span>
              <span class="text-xl leading-none text-edg-fog">
                {{ b.usable ? statsLine(b.config) : 'Unknown weapon or race' }}
              </span>
              <span
                class="bg-edg-ink px-1.5 text-lg"
                :class="b.source === 'library' ? 'text-edg-gold' : 'text-edg-mist'"
              >{{ b.source === 'library' ? 'LIBRARY' : 'DEFAULT' }}</span>
            </button>
          </li>
        </ul>
      </section>

      <aside aria-label="Match setup" class="px-panel flex min-w-0 flex-[1_1_320px] flex-col gap-[22px] px-5 pb-6 pt-[22px]">
        <h2 class="font-pixel text-xs text-edg-sand">
          MATCH
        </h2>

        <div class="flex items-center justify-between gap-2">
          <div
            v-for="(slot, i) in [selected[0], selected[1]]"
            :key="i"
            class="flex min-w-0 flex-1 flex-col items-center gap-2 bg-edg-night px-1.5 py-3.5 shadow-[inset_0_4px_0_#181425]"
            :class="i === 1 ? 'order-3' : ''"
          >
            <span class="font-pixel text-[10px]" :class="i === 0 ? 'text-[#0099db]' : 'text-edg-red'">P{{ i + 1 }}</span>
            <PixelBall v-if="slot" :fill="ballFill(slot.config)" class="size-16" />
            <span v-else class="flex size-16 items-center justify-center font-pixel text-xl text-edg-mist" aria-hidden="true">?</span>
            <span class="max-w-full truncate font-pixel text-[10px]">{{ slot?.name ?? '—' }}</span>
          </div>
          <span class="order-2 font-pixel text-base text-edg-red [text-shadow:3px_3px_0_#181425]">VS</span>
        </div>

        <div class="flex flex-col gap-3 text-2xl">
          <label class="flex cursor-pointer items-center gap-3">
            <input v-model="soundEnabled" type="checkbox" class="size-6 accent-edg-gold">
            <span>Sound</span>
          </label>
          <label class="flex cursor-pointer items-center gap-3">
            <input v-model="showHitboxes" type="checkbox" class="size-6 accent-edg-gold">
            <span>Show hitboxes <span class="text-edg-mist">(debug)</span></span>
          </label>
        </div>

        <p v-if="!canStart" role="alert" class="bg-edg-ink px-3 py-2 text-[22px] text-edg-sun">
          Pick exactly two balls to start (currently {{ selected.length }}).
        </p>
        <p v-if="recError" role="alert" class="bg-edg-ink px-3 py-2 text-[22px] text-edg-sun">
          {{ recError }}
        </p>

        <div class="flex flex-col gap-5">
          <button
            type="button"
            :disabled="!canStart"
            class="px-btn-gold h-[60px] font-pixel text-base"
            @click="startDuel(false)"
          >
            START DUEL
          </button>
          <button
            type="button"
            :disabled="!canStart"
            class="px-btn-red flex h-[52px] items-center justify-center gap-2.5 font-pixel text-xs"
            @click="startDuel(true)"
          >
            <svg width="16" height="16" viewBox="0 0 4 4" shape-rendering="crispEdges" aria-hidden="true">
              <path fill="#ffffff" d="M1 0h2v1h-2zM0 1h4v2h-4zM1 3h2v1h-2z" />
            </svg>
            AUTO RECORD
          </button>
        </div>
      </aside>
    </div>

    <section v-else class="mx-auto flex w-full max-w-[760px] flex-col items-center gap-6">
      <p v-if="recError" role="alert" class="bg-edg-ink px-3 py-2 text-[22px] text-edg-sun">
        {{ recError }}
      </p>

      <div class="relative w-full" :style="{ maxWidth: canvasStyle.maxWidth }">
        <p
          v-if="autoRecording"
          role="status"
          class="absolute left-4 top-4 z-10 flex items-center gap-2 bg-edg-ink px-2 py-1.5 font-pixel text-[10px]"
        >
          <svg width="12" height="12" viewBox="0 0 4 4" shape-rendering="crispEdges" aria-hidden="true">
            <path fill="#e43b44" d="M1 0h2v1h-2zM0 1h4v2h-4zM1 3h2v1h-2z" />
          </svg>
          REC
        </p>
        <canvas
          ref="canvasEl"
          :width="settings.width"
          :height="settings.height"
          class="block w-full shadow-[0_0_0_8px_#181425,0_0_0_12px_#8b9bb4,0_0_0_16px_#181425]"
          :style="canvasStyle"
        />
      </div>

      <!-- The result is drawn on the canvas (so it is recorded); announce it too. -->
      <p v-if="winner !== undefined" role="status" class="sr-only">
        {{ winner === null ? 'Draw' : `Winner: ${winnerName}` }}
      </p>

      <div class="mt-3 flex w-full max-w-[480px] flex-wrap gap-5">
        <button
          type="button"
          class="px-btn-gold h-14 flex-[1_1_180px] font-pixel text-sm"
          @click="rematch"
        >
          REMATCH
        </button>
        <button
          type="button"
          class="px-btn-slate h-14 flex-[1_1_180px] font-pixel text-sm"
          @click="backToPicker"
        >
          BACK
        </button>
      </div>
    </section>
  </PixelPage>
</template>
