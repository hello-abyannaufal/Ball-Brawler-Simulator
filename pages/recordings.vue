<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { useRecordingsStore, type RecordingMeta } from '~/stores/recordings'
import { getRecordingBlob } from '~/utils/recordingsDb'

const store = useRecordingsStore()

const selectedId = ref<string | null>(null)
const playbackUrl = ref<string | null>(null)
const error = ref('')

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
  <main class="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center p-4">
    <h1 class="mb-4 text-2xl font-bold">
      Recordings
    </h1>

    <p v-if="error" role="alert" class="mb-2 text-sm text-red-600">
      {{ error }}
    </p>

    <p v-if="store.items.length === 0" class="text-sm text-gray-500">
      No recordings yet. Record a duel from the Versus page.
    </p>

    <ul v-else class="w-full space-y-2">
      <li
        v-for="rec in store.items"
        :key="rec.id"
        class="flex items-center justify-between gap-2 rounded border border-black px-3 py-2"
      >
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold">
            {{ rec.name || rec.id }}
          </div>
          <div class="text-xs text-gray-500">
            {{ Math.round(rec.sizeBytes / 1024) }} KB ·
            {{ new Date(rec.createdAt).toLocaleString() }}
          </div>
        </div>
        <div class="flex shrink-0 gap-2">
          <button
            type="button"
            class="rounded bg-indigo-600 px-3 py-1 text-xs text-white"
            @click="select(rec)"
          >
            Play
          </button>
          <button
            type="button"
            class="rounded bg-gray-600 px-3 py-1 text-xs text-white"
            @click="download(rec)"
          >
            Download
          </button>
          <button
            type="button"
            class="rounded bg-red-600 px-3 py-1 text-xs text-white"
            @click="remove(rec)"
          >
            Delete
          </button>
        </div>
      </li>
    </ul>

    <video
      v-if="playbackUrl"
      :src="playbackUrl"
      controls
      autoplay
      class="mt-4 w-full max-w-[480px] border border-black"
    />
  </main>
</template>
