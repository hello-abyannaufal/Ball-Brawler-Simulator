<script setup lang="ts">
import { engineVersion } from '~/engine/engine'

const { loggedIn, user, fetch: refreshSession } = useUserSession()

async function logout(): Promise<void> {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await refreshSession()
}
</script>

<template>
  <SplashScreen v-if="!loggedIn" />

  <main
    v-else
    class="px-tiles flex min-h-screen w-full flex-col px-[clamp(28px,5vw,64px)] pb-8 pt-[clamp(28px,4vw,48px)] font-retro text-white"
  >
    <div class="mx-auto flex w-full max-w-[1100px] grow flex-col gap-[clamp(28px,4vh,48px)]">
      <header class="px-frame flex items-center gap-3 bg-edg-slate py-2 pl-3 pr-2 shadow-[inset_0_-4px_0_#262b44]">
        <PixelBall color="blue" class="size-[42px] shrink-0" />
        <p class="min-w-0 grow truncate font-pixel text-sm">
          {{ user?.username }}
        </p>
        <button
          type="button"
          aria-label="Log out"
          class="flex size-11 shrink-0 items-center justify-center bg-edg-night shadow-[inset_0_-4px_0_#181425]"
          @click="logout"
        >
          <svg width="24" height="24" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">
            <path fill="#b86f50" d="M0 0h5v8h-5z" />
            <path fill="#733e39" d="M1 1h3v6h-3z" />
            <path fill="#fee761" d="M3 4h1v1h-1z" />
            <path fill="#ffffff" d="M5 3h3v2h-3zM6 2h1v1h-1zM6 5h1v1h-1z" />
          </svg>
        </button>
      </header>

      <h1 class="flex items-baseline justify-center gap-3 font-pixel font-normal uppercase [text-shadow:4px_4px_0_#181425]">
        <span class="text-[clamp(24px,3.4vw,44px)] text-edg-gold">Ball</span>
        {{ ' ' }}
        <span class="text-[clamp(18px,2.4vw,32px)]">Brawler</span>
      </h1>

      <NavigationMenu />

      <p class="mt-auto text-center text-xl text-edg-mist">
        ENGINE v{{ engineVersion }}
      </p>
    </div>
  </main>
</template>
