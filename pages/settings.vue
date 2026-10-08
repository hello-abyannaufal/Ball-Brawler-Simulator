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

definePageMeta({ middleware: 'auth' })

const settings = useSettingsStore()
const aspectRatios = Object.keys(ASPECT_PRESETS) as AspectRatio[]

/** Number inputs: apply only in-bound values (the store sanitizes the rest). */
function onNumber(field: 'width' | 'height' | 'simulationSpeed', ev: Event): void {
  const v = Number((ev.target as HTMLInputElement).value)
  settings.update({ [field]: v })
}
</script>

<template>
  <PixelPage title="Settings">
    <form class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-8" @submit.prevent>
      <fieldset class="px-panel flex min-w-0 flex-col gap-4 px-5 pb-6 pt-[22px]">
        <legend class="float-left font-pixel text-xs text-edg-sand">
          ASPECT RATIO
        </legend>
        <div class="grid grid-cols-4 gap-3">
          <label
            v-for="r in aspectRatios"
            :key="r"
            class="flex h-12 cursor-pointer items-center justify-center font-pixel text-[11px] shadow-[0_0_0_4px_#181425] focus-within:outline focus-within:outline-4 focus-within:outline-offset-4 focus-within:outline-[#2ce8f5]"
            :class="settings.aspectRatio === r ? 'bg-edg-gold text-edg-ink' : 'bg-edg-night text-white'"
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
        <p class="text-xl leading-tight text-edg-fog">
          Choosing a ratio applies its preset resolution.
        </p>
      </fieldset>

      <fieldset class="px-panel flex min-w-0 flex-col gap-4 px-5 pb-6 pt-[22px]">
        <legend class="float-left font-pixel text-xs text-edg-sand">
          RESOLUTION (PX)
        </legend>
        <div class="flex items-end gap-3.5">
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <label for="res-w" class="font-pixel text-[9px] text-edg-fog">WIDTH</label>
            <input
              id="res-w"
              type="number"
              :min="RESOLUTION_MIN"
              :max="RESOLUTION_MAX"
              step="1"
              :value="settings.width"
              class="px-field w-full"
              @change="onNumber('width', $event)"
            >
          </div>
          <span aria-hidden="true" class="pb-4 font-pixel text-sm text-edg-mist">×</span>
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <label for="res-h" class="font-pixel text-[9px] text-edg-fog">HEIGHT</label>
            <input
              id="res-h"
              type="number"
              :min="RESOLUTION_MIN"
              :max="RESOLUTION_MAX"
              step="1"
              :value="settings.height"
              class="px-field w-full"
              @change="onNumber('height', $event)"
            >
          </div>
        </div>
        <p class="text-xl leading-tight text-edg-fog">
          Used for the duel canvas and recordings ({{ RESOLUTION_MIN }}–{{ RESOLUTION_MAX }}).
        </p>
      </fieldset>

      <fieldset class="px-panel flex min-w-0 flex-col gap-4 px-5 pb-6 pt-[22px]">
        <legend class="float-left font-pixel text-xs text-edg-sand">
          SIMULATION SPEED
        </legend>
        <div class="flex items-center gap-3.5">
          <input
            id="speed"
            type="range"
            :min="SPEED_MIN"
            :max="SPEED_MAX"
            step="0.1"
            :value="settings.simulationSpeed"
            class="h-7 min-w-0 flex-1 accent-edg-gold"
            aria-label="Simulation speed"
            @input="onNumber('simulationSpeed', $event)"
          >
          <span class="w-16 text-right font-pixel text-sm text-edg-gold">{{ settings.simulationSpeed.toFixed(1) }}×</span>
        </div>
        <p class="text-xl leading-tight text-edg-fog">
          Changes how many steps run per second; results stay identical.
        </p>
      </fieldset>

      <fieldset class="px-panel flex min-w-0 flex-col gap-4 px-5 pb-6 pt-[22px]">
        <legend class="float-left font-pixel text-xs text-edg-sand">
          SOUND
        </legend>
        <label class="flex cursor-pointer items-center justify-between gap-4 text-2xl">
          <span>Hit, clash and win effects</span>
          <input
            type="checkbox"
            role="switch"
            class="peer sr-only"
            :checked="settings.sound"
            @change="settings.update({ sound: ($event.target as HTMLInputElement).checked })"
          >
          <span
            aria-hidden="true"
            class="relative h-11 w-[88px] shrink-0 bg-edg-steel shadow-[0_0_0_4px_#181425] peer-checked:bg-edg-green peer-focus-visible:outline peer-focus-visible:outline-4 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[#2ce8f5]"
          >
            <span class="absolute top-3.5 font-pixel text-[9px]" :class="settings.sound ? 'left-2.5 text-edg-ink' : 'right-2 text-white'">
              {{ settings.sound ? 'ON' : 'OFF' }}
            </span>
            <span
              class="absolute top-1 size-9 bg-white shadow-[inset_0_-4px_0_#c0cbdc]"
              :class="settings.sound ? 'right-1' : 'left-1'"
            />
          </span>
        </label>
        <p class="text-xl leading-tight text-edg-fog">
          Played during duels and included in recordings.
        </p>
      </fieldset>
    </form>

    <button
      type="button"
      class="px-btn-slate h-[52px] self-start px-5 font-pixel text-xs"
      @click="settings.reset()"
    >
      RESET TO DEFAULTS
    </button>
  </PixelPage>
</template>
