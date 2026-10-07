<script setup lang="ts">
import { ref, computed, watch, watchEffect, nextTick, onBeforeUnmount } from 'vue'
import type { BallConfig, DuelConfig } from '~/engine/config'
import { engineVersion } from '~/engine/engine'
import { useVersusDuel, type VersusDuel } from '~/composables/useVersusDuel'
import { useAudio } from '~/composables/useAudio'
import { createRecorder, RecordingUnsupportedError, type Recorder } from '~/composables/useRecorder'
import { useRecordingsStore } from '~/stores/recordings'
import { useSettingsStore } from '~/stores/settings'
import { defaultBalls, hpBarFraction } from '~/utils/duel'

// Arena configured into a Duel_Config before running (Req 11.4).
const arena = { width: 360, height: 360 } // 1:1
const seed = ref(12345)

// Candidate balls (default balls for now; Library/Roulette feed in later).
const candidates = ref<BallConfig[]>(defaultBalls())
const selectedIds = ref<string[]>(candidates.value.map((b) => b.id))

const selected = computed(() =>
  candidates.value.filter((b) => selectedIds.value.includes(b.id)),
)
const canStart = computed(() => selected.value.length === 2) // exactly two (Req 11.1, 11.2)

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

function toggle(id: string): void {
  const i = selectedIds.value.indexOf(id)
  if (i >= 0) selectedIds.value.splice(i, 1)
  else selectedIds.value.push(id)
}

function startDuel(record = false): void {
  if (!canStart.value) return
  recError.value = ''
  const config: DuelConfig = {
    engineVersion,
    seed: seed.value,
    ballConfigs: selected.value,
    arenaConfig: arena,
  }
  duel?.dispose()
  duel = useVersusDuel(canvasEl, config, seed.value, settings.simulationSpeed, {
    showHitboxes: showHitboxes.value,
    reducedMotion: prefersReducedMotion,
  })
  // Mirror the shallowRefs into local reactive refs for the template.
  watchEffect(() => {
    hp.value = duel!.view.hp.value
    winner.value = duel!.view.winner.value
  })
  // Play a synthesized sound per engine event (Req 14.5).
  watch(
    () => duel!.view.lastEvent.value,
    (e) => {
      if (!e) return
      if (e.type === 'damage') audio.play('hit')
      else if (e.type === 'weaponClash') audio.play('clash')
      else if (e.type === 'matchEnded') audio.play('win')
    },
  )
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

// Stop recording within 2s after a winner is determined, then save (Req 14.6).
watch(winner, (w) => {
  if (w === undefined || !recorder || !autoRecording.value) return
  window.setTimeout(() => void finishRecording(), 1500)
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
  duel?.rematch()
}

onBeforeUnmount(() => {
  duel?.dispose() // Req 11.11
  duel = null
  void recorder?.stop()
  recorder = null
  audio.dispose()
})
</script>

<template>
  <main class="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center p-4">
    <h1 class="mb-3 text-2xl font-bold">
      Versus
    </h1>

    <section v-if="!running" class="mb-4 w-full max-w-xs">
      <p class="mb-2 text-sm">
        Select exactly two balls:
      </p>
      <ul class="mb-2 space-y-1">
        <li v-for="b in candidates" :key="b.id">
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              :checked="selectedIds.includes(b.id)"
              @change="toggle(b.id)"
            >
            <span>{{ b.id }}</span>
          </label>
        </li>
      </ul>
      <p v-if="!canStart" role="alert" class="mb-2 text-sm text-red-600">
        Pick exactly two balls to start (currently {{ selected.length }}).
      </p>
      <label class="mb-2 flex items-center gap-2 text-sm">
        <input v-model="showHitboxes" type="checkbox">
        <span>Show hitboxes (debug)</span>
      </label>
      <label class="mb-2 flex items-center gap-2 text-sm">
        <input v-model="soundEnabled" type="checkbox">
        <span>Sound</span>
      </label>
      <p v-if="recError" role="alert" class="mb-2 text-sm text-red-600">
        {{ recError }}
      </p>
      <div class="flex gap-2">
        <button
          type="button"
          :disabled="!canStart"
          class="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-40"
          @click="startDuel(false)"
        >
          Start duel
        </button>
        <button
          type="button"
          :disabled="!canStart"
          class="rounded bg-rose-600 px-4 py-2 text-white disabled:opacity-40"
          @click="startDuel(true)"
        >
          Auto record
        </button>
      </div>
    </section>

    <section v-else class="flex w-full flex-col items-center">
      <div class="mb-2 flex w-full max-w-[480px] justify-center gap-6">
        <div v-for="h in hp" :key="h.id" class="text-xs">
          Ball {{ h.id }}
          <div class="h-2 w-40 bg-red-900">
            <div
              class="h-2 bg-green-500"
              :style="{ width: `${hpBarFraction(h.hp, h.maxHp) * 100}%` }"
            />
          </div>
        </div>
      </div>

      <p v-if="autoRecording" role="status" class="mb-1 text-xs font-semibold text-rose-600">
        ● Recording…
      </p>
      <p v-if="recError" role="alert" class="mb-1 text-sm text-red-600">
        {{ recError }}
      </p>
      <canvas
        ref="canvasEl"
        :width="settings.width"
        :height="settings.height"
        class="w-full border border-black"
        :style="canvasStyle"
      />

      <div
        v-if="winner !== undefined"
        role="status"
        class="mt-2 text-lg font-bold"
      >
        {{ winner === null ? 'DRAW' : `Winner: Ball ${winner}` }}
      </div>

      <div class="mt-3 flex gap-2">
        <button
          type="button"
          class="rounded bg-indigo-600 px-4 py-2 text-white"
          @click="rematch"
        >
          Rematch
        </button>
        <button
          type="button"
          class="rounded bg-gray-500 px-4 py-2 text-white"
          @click="running = false"
        >
          Back
        </button>
      </div>
    </section>
  </main>
</template>
