<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { useRecordingsStore, type RecordingMeta } from '~/stores/recordings'
import { getRecordingBlob } from '~/utils/recordingsDb'

definePageMeta({ middleware: 'auth' })

const store = useRecordingsStore()

const selectedId = ref<string | null>(null)
const playbackUrl = ref<string | null>(null)
const error = ref('')
const selectedRec = computed(() => store.items.find((r) => r.id === selectedId.value) ?? null)

function revoke(): void {
  if (playbackUrl.value) {
    URL.revokeObjectURL(playbackUrl.value)
    playbackUrl.value = null
  }
}

async function select(rec: RecordingMeta): Promise<void> {
  error.value = ''
  revoke()
  selectedId.value = rec.id
  const blob = await getRecordingBlob(rec.id)
  if (!blob) {
    error.value = 'Recording data not found.'
    return
  }
  playbackUrl.value = URL.createObjectURL(blob) // play back (Req 14.10)
}

async function download(rec: RecordingMeta): Promise<void> {
  const blob = await getRecordingBlob(rec.id)
  if (!blob) {
    error.value = 'Recording data not found.'
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const ext = rec.mimeType.includes('mp4') ? 'mp4' : 'webm'
  a.download = `${rec.name || rec.id}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

async function remove(rec: RecordingMeta): Promise<void> {
  error.value = ''
  try {
    await store.removeRecording(rec.id)
  } catch {
    error.value = 'Recording could not be deleted.'
    return
  }
  if (selectedId.value === rec.id) {
    revoke() // stop playing a recording that no longer exists
    selectedId.value = null
  }
}

onBeforeUnmount(revoke)
</script>

<template>
  <PixelPage title="Recordings">
    <p v-if="error" role="alert" class="bg-edg-ink px-3 py-2 text-[22px] text-edg-sun">
      {{ error }}
    </p>

    <div class="flex flex-wrap items-start gap-9">
      <section v-if="store.items.length > 0" aria-labelledby="player-title" class="px-panel flex min-w-0 flex-[1_1_420px] flex-col items-center gap-4 px-[18px] pb-5 pt-[18px]">
        <h2 id="player-title" class="w-full truncate font-pixel text-xs text-edg-sand">
          <template v-if="selectedRec">
            ▶ {{ selectedRec.name || selectedRec.id }}
          </template>
          <template v-else>
            PLAYER
          </template>
        </h2>
        <video
          v-if="playbackUrl"
          :src="playbackUrl"
          controls
          autoplay
          class="max-h-[60vh] w-full bg-edg-ink object-contain shadow-[0_0_0_6px_#181425]"
        />
        <div
          v-else
          class="px-arena flex aspect-[9/16] max-h-[60vh] w-full max-w-[340px] items-center justify-center p-6 text-center text-2xl text-edg-sand shadow-[0_0_0_6px_#181425]"
        >
          Pick a recording and press Play.
        </div>
      </section>

      <section aria-labelledby="list-title" class="flex min-w-0 flex-[1_1_380px] flex-col gap-[18px]">
        <h2 id="list-title" class="font-pixel text-xs text-edg-sand">
          SAVED DUELS ({{ store.items.length }})
        </h2>

        <p v-if="store.items.length === 0" class="px-panel px-5 py-7 text-center text-2xl text-edg-fog">
          No recordings yet. Record a duel from the
          <NuxtLink to="/versus" class="text-edg-gold underline">
            Versus
          </NuxtLink>
          page.
        </p>

        <ul v-else class="flex flex-col gap-[22px]">
          <li
            v-for="rec in store.items"
            :key="rec.id"
            class="px-3 pb-3.5 pt-3"
            :class="rec.id === selectedId ? 'px-selected' : 'px-panel'"
          >
            <div class="min-w-0">
              <p class="truncate font-pixel text-[10px] leading-relaxed">
                {{ rec.name || rec.id }}
              </p>
              <p class="mt-1.5 text-xl leading-none text-edg-fog">
                {{ Math.round(rec.sizeBytes / 1024) }} KB ·
                {{ new Date(rec.createdAt).toLocaleString() }}
              </p>
            </div>
            <div class="mt-3 flex gap-2.5">
              <button
                type="button"
                class="px-btn-dark flex h-11 flex-1 items-center justify-center gap-2 font-pixel text-[9px]"
                @click="select(rec)"
              >
                <svg width="12" height="12" viewBox="0 0 4 4" shape-rendering="crispEdges" aria-hidden="true">
                  <path fill="#63c74d" d="M0 0h1v4h-1zM1 0.5h1v3h-1zM2 1h1v2h-1zM3 1.5h1v1h-1z" />
                </svg>
                PLAY
              </button>
              <button
                type="button"
                class="px-btn-dark flex h-11 flex-1 items-center justify-center gap-2 font-pixel text-[9px]"
                @click="download(rec)"
              >
                <svg width="12" height="12" viewBox="0 0 6 6" shape-rendering="crispEdges" aria-hidden="true">
                  <path fill="#0099db" d="M2 0h2v3h-2zM0 2h1v1h-1zM5 2h1v1h-1zM1 3h4v1h-4zM2 4h2v1h-2zM0 5h6v1h-6z" />
                </svg>
                DOWNLOAD
              </button>
              <button
                type="button"
                class="px-btn-dark flex size-11 shrink-0 items-center justify-center"
                :aria-label="`Delete ${rec.name || rec.id}`"
                @click="remove(rec)"
              >
                <svg width="16" height="16" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">
                  <path fill="#e43b44" d="M3 0h2v1h-2zM0 1h8v1h-8zM1 2h6v6h-6z" />
                  <path fill="#a22633" d="M2 3h1v4h-1zM5 3h1v4h-1z" />
                </svg>
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </PixelPage>
</template>
