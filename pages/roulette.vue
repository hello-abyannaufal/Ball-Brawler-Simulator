<script setup lang="ts">
import { ref, computed } from 'vue'
import { spinWheel, EmptyRegistryError, type WheelResult } from '~/engine/roulette'
import { weaponRegistry } from '~/engine/weapons/registry'
import { raceRegistry } from '~/engine/races/registry'
import { SEED_MAX } from '~/engine/rng'
import { useLibraryStore } from '~/stores/library'
import { useRouletteStore, MAX_WEIGHT, type WheelKind } from '~/stores/roulette'
import { usePersistenceError } from '~/stores/example'
import type { BallConfig } from '~/engine/config'
import type { WheelSlice } from '~/components/RouletteWheel.vue'
import RouletteWheel from '~/components/RouletteWheel.vue'
import '~/engine/weapons/index' // populate the registry
import '~/engine/races/index'

const SPIN_MS = 3500
const NAME_MAX = 24
const SLICE_COLORS = ['#e43b44', '#0099db', '#63c74d', '#feae34', '#b55088', '#2ce8f5', '#b86f50', '#c0cbdc']

interface WheelEntry {
  id: string
  name: string
  spriteId?: string
}

/**
 * The roulette flow: one wheel per step, in order. Spin (as often as wanted)
 * → Confirm → next step; the last step shows a name input and Save instead.
 * Add a wheel (e.g. Trait, Ability) by appending a step here and its kind to
 * `WheelKind` — the wheel, weights, and flow need no other change.
 * `optional` steps can be switched off by the user; the ball then uses defaults.
 */
const STEPS: { kind: WheelKind; label: string; optional: boolean; entries: () => WheelEntry[] }[] = [
  {
    kind: 'race',
    label: 'Race',
    optional: true,
    entries: () =>
      raceRegistry.ids().map((id) => ({ id, name: raceRegistry.get(id)?.name ?? id })),
  },
  {
    kind: 'weapon',
    label: 'Weapon',
    optional: false,
    entries: () =>
      weaponRegistry.ids().map((id) => {
        const def = weaponRegistry.get(id)
        return { id, name: def?.name ?? id, spriteId: def?.spriteId }
      }),
  },
]

const library = useLibraryStore()
const roulette = useRouletteStore()
const persistenceError = usePersistenceError()

const wheel = ref<InstanceType<typeof RouletteWheel> | null>(null)
const stepIndex = ref(0)
const picks = ref<Partial<Record<WheelKind, WheelResult>>>({}) // confirmed steps
const result = ref<WheelResult | null>(null) // current step, not yet confirmed
const ballName = ref('')
const error = ref<string>('')
const saved = ref(false)
const spinning = ref(false)

const prefersReducedMotion
  = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const activeSteps = computed(() => STEPS.filter((s) => !s.optional || roulette.isEnabled(s.kind)))
const step = computed(() => activeSteps.value[stepIndex.value]!)
const isLastStep = computed(() => stepIndex.value === activeSteps.value.length - 1)
/** Toggles only before anything is confirmed, so the step order can't shift mid-roll. */
const canToggle = computed(() => stepIndex.value === 0 && !spinning.value && !saved.value)
const nameValid = computed(() => ballName.value.trim().length > 0)

/** Current step's entries with weight, color, and share of the wheel. */
const entries = computed(() => {
  const rows = step.value.entries().map((e, i) => ({
    ...e,
    color: SLICE_COLORS[i % SLICE_COLORS.length]!,
    weight: roulette.weightOf(step.value.kind, e.id),
  }))
  const total = rows.reduce((s, r) => s + r.weight, 0)
  return rows.map((r) => ({ ...r, share: total > 0 ? r.weight / total : 0 }))
})

const slices = computed<WheelSlice[]>(() =>
  entries.value
    .filter((e) => e.weight > 0)
    .map((e) => ({ id: e.id, weight: e.weight, color: e.color, spriteId: e.spriteId })),
)

function entryName(stepIdx: number, id: string): string {
  return activeSteps.value[stepIdx]!.entries().find((e) => e.id === id)?.name ?? id
}

function randomSeed(): number {
  // Non-deterministic seed source is fine HERE (not in the engine): the engine
  // stays deterministic given the seed we record.
  return Math.floor(Math.random() * (SEED_MAX + 1))
}

async function doSpin(): Promise<void> {
  if (spinning.value || saved.value) return
  error.value = ''

  // Always a fresh random seed; it is still recorded with the result and the
  // saved ball (Req 12.2, 12.7), just not shown or editable.
  const seed = randomSeed()

  let drawn: WheelResult
  try {
    // Decided instantly and deterministically; the wheel only animates to it.
    drawn = spinWheel(seed, slices.value, step.value.kind)
  } catch (e) {
    error.value = e instanceof EmptyRegistryError ? e.message : 'Spin failed.'
    return // retain any previous result (Req 12.4)
  }

  spinning.value = true
  result.value = null
  await wheel.value?.spinTo(drawn.id, drawn.landing, prefersReducedMotion ? 0 : SPIN_MS)
  result.value = drawn
  spinning.value = false
}

/** Lock in the current step's result and move to the next wheel. */
function confirmStep(): void {
  if (!result.value || isLastStep.value) return
  picks.value = { ...picks.value, [step.value.kind]: result.value }
  result.value = null
  stepIndex.value += 1
}

function saveBall(): void {
  if (!result.value || !nameValid.value) return
  const all = { ...picks.value, [step.value.kind]: result.value }
  const weapon = all.weapon
  if (!weapon) return
  // Build a ball config carrying every drawn pick (Req 12.7).
  const config: BallConfig = {
    id: `roulette-${weapon.seed}`,
    radius: 32,
    maxHp: 100,
    initialPosition: { x: 0, y: 0 },
    initialVelocity: { x: 120, y: 0 },
    weapons: [{ weaponId: weapon.id }],
    raceId: all.race?.id, // supplies HP and radius; off ⇒ defaults above
    appearance: { type: 'color', value: '#feae34' },
  }
  const seeds = Object.fromEntries(Object.entries(all).map(([k, r]) => [k, r.seed]))
  library.addBall(config, ballName.value.trim(), seeds)
  if (persistenceError.value.failed) {
    error.value = persistenceError.value.message // save-failure (Req 12.8)
    saved.value = false // keep the unsaved result on screen
  } else {
    picks.value = all
    saved.value = true
  }
}

/** Start a fresh roll from the first wheel. */
function restart(): void {
  stepIndex.value = 0
  picks.value = {}
  result.value = null
  ballName.value = ''
  error.value = ''
  saved.value = false
}

function onToggleStep(kind: WheelKind, ev: Event): void {
  roulette.setEnabled(kind, (ev.target as HTMLInputElement).checked)
  restart()
}

function onWeightInput(id: string, ev: Event): void {
  roulette.setWeight(step.value.kind, id, Number((ev.target as HTMLInputElement).value))
}
</script>

<template>
  <main class="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center p-4">
    <h1 class="mb-3 text-2xl font-bold">
      Roulette
    </h1>

    <!-- Optional wheels can be switched off (Weapon is always on). -->
    <div class="mb-2 flex flex-wrap justify-center gap-3 text-xs">
      <label
        v-for="s in STEPS.filter((x) => x.optional)"
        :key="s.kind"
        class="flex items-center gap-1"
        :class="{ 'opacity-40': !canToggle }"
      >
        <input
          type="checkbox"
          :checked="roulette.isEnabled(s.kind)"
          :disabled="!canToggle"
          @change="onToggleStep(s.kind, $event)"
        >
        {{ s.label }}
      </label>
    </div>

    <!-- Step progress: confirmed steps show their pick. -->
    <ol class="mb-3 flex flex-wrap justify-center gap-2 text-xs">
      <li
        v-for="(s, i) in activeSteps"
        :key="s.kind"
        class="rounded border px-2 py-1"
        :class="
          i === stepIndex && !saved
            ? 'border-indigo-600 bg-indigo-600 text-white'
            : picks[s.kind]
              ? 'border-green-700 text-green-700'
              : 'border-gray-400 text-gray-500'
        "
      >
        {{ i + 1 }}. {{ s.label }}<template v-if="picks[s.kind]">
          ✓ {{ entryName(i, picks[s.kind]!.id) }}
        </template>
      </li>
    </ol>

    <h2 v-if="!saved" class="mb-2 text-lg font-semibold">
      Spin the {{ step.label }} wheel
    </h2>

    <RouletteWheel ref="wheel" :slices="slices" class="mb-3" />

    <button
      v-if="!saved"
      type="button"
      class="mb-3 rounded bg-indigo-600 px-8 py-2 text-lg font-semibold text-white disabled:opacity-40"
      :disabled="spinning"
      @click="doSpin"
    >
      {{ spinning ? 'Spinning…' : result ? 'Spin again' : 'Spin' }}
    </button>

    <p v-if="error" role="alert" class="mb-2 text-sm text-red-600">
      {{ error }}
    </p>

    <!-- Current step's result → Confirm, or (last step) name + Save. -->
    <div v-if="result && !spinning && !saved" class="mb-4 flex w-full max-w-xs flex-col items-center gap-2">
      <p class="text-sm font-bold text-[#feae34]">
        {{ step.label }}: {{ entryName(stepIndex, result.id) }}
      </p>

      <button
        v-if="!isLastStep"
        type="button"
        class="rounded bg-green-600 px-6 py-1 font-semibold text-white"
        @click="confirmStep"
      >
        Confirm
      </button>

      <form v-else class="flex w-full flex-col gap-2" @submit.prevent="saveBall">
        <label for="ball-name" class="text-xs font-semibold">Ball name</label>
        <input
          id="ball-name"
          v-model="ballName"
          type="text"
          :maxlength="NAME_MAX"
          placeholder="Name your ball"
          class="rounded border border-black px-2 py-1 text-sm"
        >
        <button
          type="submit"
          class="rounded bg-green-600 px-6 py-1 font-semibold text-white disabled:opacity-40"
          :disabled="!nameValid"
        >
          Save
        </button>
      </form>
    </div>

    <div v-if="saved" class="mb-4 flex flex-col items-center gap-2">
      <p role="status" class="text-sm text-green-700">
        Saved "{{ ballName.trim() }}" to Library.
      </p>
      <button
        type="button"
        class="rounded bg-indigo-600 px-6 py-1 font-semibold text-white"
        @click="restart"
      >
        Roll another ball
      </button>
    </div>

    <!-- Slice-size editor for the current wheel (0 removes the slice). -->
    <section v-if="!saved" class="w-full max-w-xs">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-bold">
          {{ step.label }} odds
        </h2>
        <button
          type="button"
          class="text-xs underline disabled:opacity-40"
          :disabled="spinning"
          @click="roulette.resetWeights(step.kind)"
        >
          Reset
        </button>
      </div>
      <ul class="space-y-2">
        <li v-for="e in entries" :key="e.id" class="flex items-center gap-2 text-sm">
          <span class="inline-block h-3 w-3 shrink-0 border border-black" :style="{ background: e.color }" />
          <label :for="`w-${e.id}`" class="w-28 shrink-0 truncate">{{ e.name }}</label>
          <input
            :id="`w-${e.id}`"
            type="range"
            min="0"
            :max="MAX_WEIGHT"
            :value="e.weight"
            :disabled="spinning"
            class="flex-1"
            @input="onWeightInput(e.id, $event)"
          >
          <span class="w-10 text-right tabular-nums">{{ Math.round(e.share * 100) }}%</span>
        </li>
      </ul>
    </section>
  </main>
</template>
