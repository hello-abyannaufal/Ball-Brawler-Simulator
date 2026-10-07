<script setup lang="ts">
import { ref } from 'vue'
import { useLibraryStore, type SavedBall } from '~/stores/library'
import { useSettingsStore, sanitizeSettings } from '~/stores/settings'
import { usePersistenceError } from '~/stores/example'
import { weaponRegistry } from '~/engine/weapons/registry'
import { buildExport, exportToJson, parseImport } from '~/utils/libraryIo'
import '~/engine/weapons/index' // populate the registry

const library = useLibraryStore()
const settings = useSettingsStore()
const persistenceError = usePersistenceError()

const fileInput = ref<HTMLInputElement | null>(null)
const message = ref('')
const error = ref('')

function weaponNames(ball: SavedBall): string {
  const names = ball.config.weapons.map((w) => weaponRegistry.get(w.weaponId)?.name ?? `${w.weaponId} (unknown)`)
  return names.length ? names.join(', ') : 'No weapon'
}

function ballColor(ball: SavedBall): string {
  return ball.config.appearance?.type === 'color' ? ball.config.appearance.value : '#c0cbdc'
}

/** Older saves have no name (before the roulette naming step). */
function displayName(ball: SavedBall): string {
  return ball.name || ball.config.id
}

function removeBall(ball: SavedBall): void {
  if (!window.confirm(`Delete "${displayName(ball)}"?`)) return
  library.removeBall(ball.id)
  message.value = ''
  error.value = persistenceError.value.failed ? persistenceError.value.message : ''
}

/** Download Library + Settings as one JSON document (Req 13.6). */
function exportJson(): void {
  const doc = buildExport(
    { balls: library.balls, weapons: library.weapons, duels: library.duels },
    { ...settings.$state },
  )
  const blob = new Blob([exportToJson(doc)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ballbrawler-library-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  error.value = ''
  message.value = 'Exported.'
}

/** Replace Library + Settings from a JSON file, or reject leaving both unchanged (Req 13.7, 13.8). */
async function importJson(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-importing the same file
  if (!file) return
  message.value = ''
  const doc = parseImport(await file.text())
  if (!doc) {
    error.value = 'Import failed: the file is not a valid Ball Brawler export.'
    return
  }
  if (!window.confirm('Importing replaces your current Library and Settings. Continue?')) return
  library.replaceAll(doc.library)
  settings.$patch((s) => Object.assign(s, sanitizeSettings(doc.settings)))
  error.value = ''
  message.value = `Imported ${doc.library.balls.length} ball(s).`
}
</script>

<template>
  <main class="mx-auto w-full max-w-md p-6">
    <h1 class="mb-4 text-2xl font-bold">
      Library
    </h1>

    <p v-if="error" role="alert" class="mb-3 text-sm text-red-600">
      {{ error }}
    </p>
    <p v-if="message" role="status" class="mb-3 text-sm text-green-700">
      {{ message }}
    </p>

    <section class="mb-6">
      <h2 class="mb-2 font-semibold">
        Balls ({{ library.balls.length }})
      </h2>

      <p v-if="library.balls.length === 0" class="text-sm text-gray-600">
        No saved balls yet.
        <NuxtLink to="/roulette" class="underline">
          Roll one in Roulette
        </NuxtLink>.
      </p>

      <ul v-else class="divide-y rounded border border-gray-300">
        <li
          v-for="ball in library.balls"
          :key="ball.id"
          class="flex items-center gap-3 px-3 py-2"
        >
          <span
            class="inline-block h-6 w-6 shrink-0 rounded-full border-2 border-black"
            :style="{ background: ballColor(ball) }"
            aria-hidden="true"
          />
          <div class="min-w-0 flex-1">
            <p class="truncate font-semibold">
              {{ displayName(ball) }}
            </p>
            <p class="truncate text-xs text-gray-600">
              {{ weaponNames(ball) }} · HP {{ ball.config.maxHp }}
            </p>
          </div>
          <button
            type="button"
            class="rounded bg-red-600 px-3 py-1 text-xs text-white"
            :aria-label="`Delete ${displayName(ball)}`"
            @click="removeBall(ball)"
          >
            Delete
          </button>
        </li>
      </ul>

      <NuxtLink
        v-if="library.balls.length >= 1"
        to="/versus"
        class="mt-3 inline-block text-sm underline"
      >
        Use them in Versus →
      </NuxtLink>
    </section>

    <section>
      <h2 class="mb-2 font-semibold">
        Backup
      </h2>
      <p class="mb-2 text-xs text-gray-600">
        Export saves your Library and Settings to a JSON file. Import replaces both.
      </p>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded bg-indigo-600 px-4 py-2 text-sm text-white"
          @click="exportJson"
        >
          Export JSON
        </button>
        <button
          type="button"
          class="rounded bg-gray-600 px-4 py-2 text-sm text-white"
          @click="fileInput?.click()"
        >
          Import JSON
        </button>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          class="hidden"
          @change="importJson"
        >
      </div>
    </section>
  </main>
</template>
