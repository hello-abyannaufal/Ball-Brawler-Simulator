<script setup lang="ts">
import { ref } from 'vue'
import { useLibraryStore, type SavedBall } from '~/stores/library'
import { useSettingsStore, sanitizeSettings } from '~/stores/settings'
import { usePersistenceError } from '~/stores/example'
import { weaponRegistry } from '~/engine/weapons/registry'
import { raceRegistry } from '~/engine/races/registry'
import { buildExport, exportToJson, parseImport } from '~/utils/libraryIo'
import { spriteSource } from '~/assets/sprites/manifest'
import '~/engine/weapons/index' // populate the registry
import '~/engine/races/index'

definePageMeta({ middleware: 'auth' })

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

/** Race name, or '' for balls saved before races. */
function raceName(ball: SavedBall): string {
  const id = ball.config.raceId
  if (id === undefined) return ''
  return raceRegistry.get(id)?.name ?? `${id} (unknown)`
}

/** The race supplies HP when set. */
function maxHp(ball: SavedBall): number {
  const id = ball.config.raceId
  return (id !== undefined && raceRegistry.get(id)?.maxHp) || ball.config.maxHp
}

/** Sprite image of the ball's first weapon, or null when it has none. */
function weaponSprite(ball: SavedBall): string | null {
  const spriteId = weaponRegistry.get(ball.config.weapons[0]?.weaponId ?? '')?.spriteId
  const src = spriteId ? spriteSource(spriteId) : null
  return src?.kind === 'image' ? src.src : null
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
  <PixelPage title="Library">
    <template #actions>
      <NuxtLink to="/roulette" class="px-btn-gold flex h-11 shrink-0 items-center px-3.5 font-pixel text-[10px]">
        + NEW BALL
      </NuxtLink>
    </template>

    <p v-if="error" role="alert" class="bg-edg-ink px-3 py-2 text-[22px] text-edg-sun">
      {{ error }}
    </p>
    <p v-if="message" role="status" class="bg-edg-ink px-3 py-2 text-[22px] text-edg-green">
      {{ message }}
    </p>

    <div class="flex flex-wrap items-start gap-9">
      <section aria-labelledby="balls-title" class="flex min-w-0 flex-[999_1_540px] flex-col gap-5">
        <h2 id="balls-title" class="font-pixel text-xs text-edg-sand">
          BALLS ({{ library.balls.length }})
        </h2>

        <div
          v-if="library.balls.length === 0"
          class="px-panel flex flex-col items-center gap-3.5 px-5 py-9 text-center"
        >
          <PixelBall fill="#feae34" class="size-16 opacity-50" />
          <p class="text-2xl text-edg-fog">
            No saved balls yet.
          </p>
          <NuxtLink to="/roulette" class="px-btn-gold flex h-[52px] items-center px-[18px] font-pixel text-xs">
            Roll one in Roulette
          </NuxtLink>
        </div>

        <template v-else>
          <ul class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[22px]">
            <li
              v-for="ball in library.balls"
              :key="ball.id"
              class="px-panel flex items-center gap-3.5 px-3 pb-3.5 pt-3"
            >
              <div class="relative h-16 w-[88px] shrink-0 bg-edg-night shadow-[inset_0_4px_0_#181425]" aria-hidden="true">
                <PixelBall :fill="ballColor(ball)" class="absolute left-1.5 top-1.5 size-[52px]" />
                <img
                  v-if="weaponSprite(ball)"
                  :src="weaponSprite(ball)!"
                  alt=""
                  class="absolute right-0.5 top-3.5 size-10 -rotate-45 object-contain [image-rendering:pixelated]"
                >
              </div>
              <div class="flex min-w-0 flex-1 flex-col gap-1.5">
                <p class="truncate font-pixel text-xs">
                  {{ displayName(ball) }}
                </p>
                <p class="truncate text-xl leading-none text-edg-fog">
                  <template v-if="raceName(ball)">
                    {{ raceName(ball) }} ·
                  </template>
                  {{ weaponNames(ball) }}
                </p>
                <p class="text-xl leading-none text-edg-green">
                  HP {{ maxHp(ball) }}
                </p>
              </div>
              <button
                type="button"
                class="px-btn-dark flex size-11 shrink-0 items-center justify-center"
                :aria-label="`Delete ${displayName(ball)}`"
                @click="removeBall(ball)"
              >
                <svg width="20" height="20" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">
                  <path fill="#e43b44" d="M3 0h2v1h-2zM0 1h8v1h-8zM1 2h6v6h-6z" />
                  <path fill="#a22633" d="M2 3h1v4h-1zM5 3h1v4h-1z" />
                </svg>
              </button>
            </li>
          </ul>

          <NuxtLink to="/versus" class="flex min-h-11 items-center self-start text-2xl text-edg-gold underline">
            Use them in Versus →
          </NuxtLink>
        </template>
      </section>

      <aside aria-labelledby="backup-title" class="px-panel flex min-w-0 flex-[1_1_300px] flex-col gap-4 px-5 pb-6 pt-[22px]">
        <h2 id="backup-title" class="font-pixel text-xs text-edg-sand">
          BACKUP
        </h2>
        <p class="text-[22px] leading-tight text-edg-fog">
          Export saves your Library and Settings to a JSON file. Import replaces both.
        </p>
        <div class="mt-1.5 flex flex-wrap gap-5">
          <button
            type="button"
            class="px-btn-slate h-[52px] flex-[1_1_140px] !bg-edg-steel font-pixel text-[11px]"
            @click="exportJson"
          >
            EXPORT JSON
          </button>
          <button
            type="button"
            class="px-btn-slate h-[52px] flex-[1_1_140px] !bg-edg-steel font-pixel text-[11px]"
            @click="fileInput?.click()"
          >
            IMPORT JSON
          </button>
          <input
            ref="fileInput"
            type="file"
            accept="application/json,.json"
            class="hidden"
            @change="importJson"
          >
        </div>
      </aside>
    </div>
  </PixelPage>
</template>
