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

definePageMeta({ middleware: 'auth' })

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
  <PixelPage title="Roulette">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <!-- Step progress: confirmed steps show their pick. -->
      <ol class="flex flex-wrap gap-3.5">
        <li
          v-for="(s, i) in activeSteps"
          :key="s.kind"
          :aria-current="i === stepIndex && !saved ? 'step' : undefined"
          class="flex items-center gap-2 px-3 py-2.5 font-pixel text-[10px] uppercase"
          :class="
            i === stepIndex && !saved
              ? 'bg-edg-gold text-edg-ink'
              : picks[s.kind]
                ? 'bg-edg-ink text-edg-green shadow-[inset_0_0_0_4px_#3e8948]'
                : 'bg-edg-ink text-edg-mist'
          "
        >
          {{ i + 1 }} {{ s.label }}<template v-if="picks[s.kind]">
            · {{ entryName(i, picks[s.kind]!.id) }}
          </template>
        </li>
      </ol>

      <!-- Optional wheels can be switched off (Weapon is always on). -->
      <div class="flex flex-wrap gap-4">
        <label
          v-for="s in STEPS.filter((x) => x.optional)"
          :key="s.kind"
          class="flex cursor-pointer items-center gap-2.5 text-[22px] text-edg-fog"
          :class="{ 'cursor-not-allowed opacity-40': !canToggle }"
        >
          <input
            type="checkbox"
            class="size-[22px] accent-edg-gold"
            :checked="roulette.isEnabled(s.kind)"
            :disabled="!canToggle"
            @change="onToggleStep(s.kind, $event)"
          >
          {{ s.label }} wheel
        </label>
      </div>
    </div>

    <div class="flex flex-wrap items-start gap-10">
      <section aria-labelledby="wheel-title" class="flex min-w-0 flex-[1_1_340px] flex-col items-center gap-7">
        <h2 id="wheel-title" class="font-pixel text-xs uppercase text-edg-sand">
          <template v-if="!saved">
            Spin the {{ step.label }} wheel
          </template>
          <template v-else>
            Ball saved
          </template>
        </h2>

        <RouletteWheel ref="wheel" :slices="slices" />

        <button
          v-if="!saved"
          type="button"
          class="px-btn-gold h-16 w-full max-w-[320px] font-pixel text-lg"
          :disabled="spinning"
          @click="doSpin"
        >
          {{ spinning ? 'SPINNING…' : result ? 'SPIN AGAIN' : 'SPIN' }}
        </button>

        <p v-if="error" role="alert" class="bg-edg-ink px-3 py-2 text-[22px] text-edg-sun">
          {{ error }}
        </p>
      </section>

      <div class="flex min-w-0 flex-[1_1_340px] flex-col gap-8">
        <!-- Current step's result → Confirm, or (last step) name + Save. -->
        <section
          v-if="result && !spinning && !saved"
          aria-labelledby="result-title"
          class="px-panel flex flex-col gap-[18px] px-5 pb-6 pt-[22px]"
        >
          <h2 id="result-title" class="font-pixel text-xs text-edg-sand">
            RESULT
          </h2>
          <p class="font-pixel text-sm uppercase text-edg-gold">
            {{ step.label }}: {{ entryName(stepIndex, result.id) }}
          </p>

          <button
            v-if="!isLastStep"
            type="button"
            class="px-btn-green h-14 font-pixel text-sm"
            @click="confirmStep"
          >
            CONFIRM
          </button>

          <form v-else class="flex flex-col gap-2.5" @submit.prevent="saveBall">
            <label for="ball-name" class="font-pixel text-[10px] text-edg-sand">BALL NAME</label>
            <input
              id="ball-name"
              v-model="ballName"
              type="text"
              :maxlength="NAME_MAX"
              placeholder="Name your ball"
              class="px-field placeholder:text-edg-mist"
            >
            <button
              type="submit"
              class="px-btn-green mt-3.5 h-14 font-pixel text-sm"
              :disabled="!nameValid"
            >
              SAVE TO LIBRARY
            </button>
          </form>
        </section>

        <section v-if="saved" class="px-panel flex flex-col items-center gap-4 px-5 pb-6 pt-[22px] text-center">
          <p role="status" class="text-2xl text-edg-green">
            Saved "{{ ballName.trim() }}" to Library.
          </p>
          <button
            type="button"
            class="px-btn-gold h-[52px] w-full font-pixel text-xs"
            @click="restart"
          >
            ROLL ANOTHER BALL
          </button>
          <NuxtLink to="/library" class="flex min-h-11 items-center text-2xl text-edg-gold underline">
            Open Library →
          </NuxtLink>
        </section>

        <!-- Slice-size editor for the current wheel (0 removes the slice). -->
        <section v-if="!saved" aria-labelledby="odds-title" class="px-panel flex flex-col gap-4 px-5 pb-6 pt-[22px]">
          <div class="flex items-center justify-between gap-3">
            <h2 id="odds-title" class="font-pixel text-xs uppercase text-edg-sand">
              {{ step.label }} odds
            </h2>
            <button
              type="button"
              class="min-h-11 px-2 text-[22px] text-edg-gold underline disabled:opacity-40"
              :disabled="spinning"
              @click="roulette.resetWeights(step.kind)"
            >
              Reset
            </button>
          </div>
          <ul class="flex flex-col gap-3">
            <li v-for="e in entries" :key="e.id" class="flex items-center gap-2.5 text-[22px]">
              <span class="size-4 shrink-0 shadow-[0_0_0_3px_#181425]" :style="{ background: e.color }" />
              <label :for="`w-${e.id}`" class="w-24 shrink-0 truncate">{{ e.name }}</label>
              <input
                :id="`w-${e.id}`"
                type="range"
                min="0"
                :max="MAX_WEIGHT"
                :value="e.weight"
                :disabled="spinning"
                class="min-w-0 flex-1 accent-edg-gold"
                @input="onWeightInput(e.id, $event)"
              >
              <span class="w-11 text-right tabular-nums">{{ Math.round(e.share * 100) }}%</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </PixelPage>
</template>
