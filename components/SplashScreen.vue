<script setup lang="ts">
import { engineVersion } from '~/engine/engine'
</script>

<template>
  <main
    class="px-tiles relative flex min-h-screen w-full flex-col items-center px-[clamp(20px,6vw,48px)] pb-10 pt-[clamp(48px,10vh,88px)] font-retro text-white"
  >
    <h1 class="flex flex-col items-center gap-4 text-center font-pixel font-normal uppercase leading-none">
      <span class="text-[clamp(56px,8vw,104px)] text-edg-gold [text-shadow:4px_4px_0_#733e39,8px_8px_0_#181425]">Ball</span>
      {{ ' ' }}
      <span class="text-[clamp(36px,5vw,64px)] [text-shadow:4px_4px_0_#3a4466,8px_8px_0_#181425]">Brawler</span>
    </h1>
    <p class="mt-6 bg-edg-ink px-3 py-1 text-[clamp(24px,2.4vw,30px)] tracking-widest text-edg-fog">
      AUTO-BATTLE ARENA
    </p>

    <div
      class="px-frame mt-[clamp(40px,6vh,64px)] flex h-[clamp(200px,26vw,300px)] w-full max-w-[680px] items-center justify-between bg-edg-brown px-[clamp(12px,4vw,48px)] [--u:clamp(84px,11vw,136px)]"
      aria-hidden="true"
    >
      <div class="flex items-center">
        <PixelBall color="blue" class="size-[var(--u)]" />
        <img
          src="/sprites/weapons/sword.png"
          alt=""
          class="-ml-[calc(var(--u)*0.2)] size-[calc(var(--u)*0.76)] [image-rendering:pixelated]"
        >
      </div>
      <span class="font-pixel text-[clamp(20px,3vw,36px)] text-edg-red [text-shadow:4px_4px_0_#181425]">VS</span>
      <div class="flex items-center">
        <img
          src="/sprites/weapons/hammer.png"
          alt=""
          class="relative z-10 -mr-[calc(var(--u)*0.2)] size-[calc(var(--u)*0.76)] -scale-x-100 [image-rendering:pixelated]"
        >
        <PixelBall color="red" class="size-[var(--u)]" />
      </div>
    </div>

    <div class="min-h-10 grow" />

    <div class="flex w-full max-w-[560px] flex-wrap gap-6">
      <NuxtLink
        to="/login"
        class="px-btn-gold flex h-16 flex-[1_1_220px] items-center justify-center font-pixel text-xl"
      >
        LOGIN
      </NuxtLink>
    </div>

    <p class="mt-8 text-xl text-edg-mist">
      ENGINE v{{ engineVersion }}
    </p>

    <slot />
  </main>
</template>
