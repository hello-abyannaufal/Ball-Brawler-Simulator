<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import type { BallConfig, DuelConfig } from '~/engine/config'
import { engineVersion } from '~/engine/engine'
import { useVersusDuel, type VersusDuel } from '~/composables/useVersusDuel'
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

function toggle(id: string): void {
  const i = selectedIds.value.indexOf(id)
  if (i >= 0) selectedIds.value.splice(i, 1)
  else selectedIds.value.push(id)
}

function startDuel(): void {
  if (!canStart.value) return
  const config: DuelConfig = {
    engineVersion,
    seed: seed.value,
    ballConfigs: selected.value,
    arenaConfig: arena,
  }
  duel?.dispose()
  duel = useVersusDuel(canvasEl, config, seed.value, 1, {
    showHitboxes: showHitboxes.value,
  })
  // Mirror the shallowRefs into local reactive refs for the template.
  watchEffect(() => {
    hp.value = duel!.view.hp.value
    winner.value = duel!.view.winner.value
  })
  running.value = true
  duel.start()
}

function rematch(): void {
  duel?.rematch()
}

onBeforeUnmount(() => {
  duel?.dispose() // Req 11.11
  duel = null
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
      <button
        type="button"
        :disabled="!canStart"
        class="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-40"
        @click="startDuel"
      >
        Start duel
      </button>
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

      <canvas
        ref="canvasEl"
        :width="arena.width"
        :height="arena.height"
        class="aspect-square w-full max-w-[480px] border border-black"
        style="image-rendering: pixelated;"
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
