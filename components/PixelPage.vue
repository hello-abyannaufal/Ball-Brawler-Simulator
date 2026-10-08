<script setup lang="ts">
/** Shared shell for menu pages: tiled background, back-to-Home button, title, optional actions. */
defineProps<{ title: string }>()
</script>

<template>
  <main
    class="px-tiles min-h-screen w-full px-[clamp(20px,5vw,64px)] pb-10 pt-[clamp(24px,4vw,48px)] font-retro text-white"
  >
    <div class="mx-auto flex max-w-[1200px] flex-col gap-8">
      <header class="flex items-center gap-4">
        <NuxtLink
          to="/"
          aria-label="Back to menu"
          class="px-btn-slate flex size-11 shrink-0 items-center justify-center"
        >
          <svg width="24" height="24" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">
            <path fill="#ffffff" d="M3 1h1v1h-1zM2 2h1v1h-1zM1 3h6v2h-6zM2 5h1v1h-1zM3 6h1v1h-1z" />
          </svg>
        </NuxtLink>
        <h1 class="grow font-pixel text-[clamp(20px,2.6vw,30px)] font-normal uppercase text-edg-gold [text-shadow:4px_4px_0_#181425]">
          {{ title }}
        </h1>
        <slot name="actions" />
      </header>

      <slot />
    </div>
  </main>
</template>
