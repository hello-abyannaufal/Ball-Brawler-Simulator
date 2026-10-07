<script setup lang="ts">
import {
  useSettingsStore,
  ASPECT_PRESETS,
  RESOLUTION_MIN,
  RESOLUTION_MAX,
  SPEED_MIN,
  SPEED_MAX,
  type AspectRatio,
} from '~/stores/settings'

const settings = useSettingsStore()
const aspectRatios = Object.keys(ASPECT_PRESETS) as AspectRatio[]

/** Number inputs: apply only in-bound values (the store sanitizes the rest). */
function onNumber(field: 'width' | 'height' | 'simulationSpeed', ev: Event): void {
  const v = Number((ev.target as HTMLInputElement).value)
  settings.update({ [field]: v })
}
</script>

<template>
  <main class="mx-auto w-full max-w-md p-6">
    <h1 class="mb-6 text-2xl font-bold">
      Settings
    </h1>

    <form class="flex flex-col gap-6" @submit.prevent>
      <fieldset>
        <legend class="mb-2 font-semibold">
          Aspect ratio
        </legend>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="r in aspectRatios"
            :key="r"
            class="flex cursor-pointer items-center gap-1 rounded border px-3 py-1 text-sm focus-within:ring-2 focus-within:ring-blue-500"
            :class="settings.aspectRatio === r ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-400'"
          >
            <input
              type="radio"
              name="aspect"
              class="sr-only"
              :value="r"
              :checked="settings.aspectRatio === r"
              @change="settings.setAspectRatio(r)"
            >
            {{ r }}
          </label>
        </div>
        <p class="mt-1 text-xs text-gray-600">
          Choosing a ratio applies its preset resolution.
        </p>
      </fieldset>

      <fieldset>
        <legend class="mb-2 font-semibold">
          Resolution (px)
        </legend>
        <div class="flex items-center gap-2">
          <label class="sr-only" for="res-w">Width</label>
          <input
            id="res-w"
            type="number"
            :min="RESOLUTION_MIN"
            :max="RESOLUTION_MAX"
            step="1"
            :value="settings.width"
            class="w-28 rounded border border-black px-2 py-1"
            @change="onNumber('width', $event)"
          >
          <span aria-hidden="true">×</span>
          <label class="sr-only" for="res-h">Height</label>
          <input
            id="res-h"
            type="number"
            :min="RESOLUTION_MIN"
            :max="RESOLUTION_MAX"
            step="1"
            :value="settings.height"
            class="w-28 rounded border border-black px-2 py-1"
            @change="onNumber('height', $event)"
          >
        </div>
        <p class="mt-1 text-xs text-gray-600">
          Used for the duel canvas and recordings ({{ RESOLUTION_MIN }}–{{ RESOLUTION_MAX }}).
        </p>
      </fieldset>

      <fieldset>
        <legend class="mb-2 font-semibold">
          Simulation speed
        </legend>
        <div class="flex items-center gap-3">
          <input
            id="speed"
            type="range"
            :min="SPEED_MIN"
            :max="SPEED_MAX"
            step="0.1"
            :value="settings.simulationSpeed"
            class="flex-1"
            aria-label="Simulation speed"
            @input="onNumber('simulationSpeed', $event)"
          >
          <span class="w-12 text-right tabular-nums">{{ settings.simulationSpeed.toFixed(1) }}×</span>
        </div>
        <p class="mt-1 text-xs text-gray-600">
          Changes how many steps run per second; results stay identical.
        </p>
      </fieldset>

      <label class="flex items-center gap-2 font-semibold">
        <input
          type="checkbox"
          :checked="settings.sound"
          @change="settings.update({ sound: ($event.target as HTMLInputElement).checked })"
        >
        Sound
      </label>

      <div>
        <button
          type="button"
          class="rounded bg-gray-600 px-4 py-2 text-white"
          @click="settings.reset()"
        >
          Reset to defaults
        </button>
      </div>
    </form>
  </main>
</template>
