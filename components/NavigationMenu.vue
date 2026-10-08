<script setup lang="ts">
interface PixelShape {
  fill: string
  d: string
}

interface NavLink {
  to: string
  label: string
  /** 8×8 pixel icon, one path per color. */
  icon: readonly PixelShape[]
}

const DOT = 'M2 0h4v1h-4zM1 1h6v1h-6zM0 2h8v4h-8zM1 6h6v1h-6zM2 7h4v1h-4z'

const links: readonly NavLink[] = [
  {
    to: '/roulette',
    label: 'Roulette',
    icon: [
      { fill: '#feae34', d: DOT },
      { fill: '#e43b44', d: 'M2 0h2v4h-4v-2h1v-1h1zM4 4h4v2h-1v1h-1v1h-2z' },
      { fill: '#181425', d: 'M3 3h2v2h-2z' },
    ],
  },
  {
    to: '/library',
    label: 'Library',
    icon: [
      { fill: '#0099db', d: 'M1 0h6v8h-6z' },
      { fill: '#124e89', d: 'M1 0h1v8h-1z' },
      { fill: '#ead4aa', d: 'M3 2h3v1h-3zM3 4h3v1h-3z' },
    ],
  },
  {
    to: '/recordings',
    label: 'Recordings',
    icon: [
      { fill: '#181425', d: DOT },
      { fill: '#e43b44', d: 'M3 1h2v1h-2zM2 2h4v4h-4zM3 6h2v1h-2z' },
      { fill: '#f6757a', d: 'M3 2h1v1h-1z' },
    ],
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: [
      { fill: '#c0cbdc', d: 'M3 0h2v8h-2zM0 3h8v2h-8zM1 1h6v6h-6z' },
      { fill: '#8b9bb4', d: 'M1 5h1v2h-1zM2 6h5v1h-5zM6 5h1v1h-1z' },
      { fill: '#3a4466', d: 'M3 3h2v2h-2z' },
    ],
  },
]

const router = useRouter()

function navigate(to: string): void {
  router.push(to)
}
</script>

<template>
  <nav aria-label="Main menu" class="flex flex-wrap gap-7">
    <NuxtLink
      to="/versus"
      class="px-btn-gold flex min-h-[200px] flex-[1_1_340px] flex-col items-center justify-center gap-2.5 px-4 pb-6 pt-5 focus-visible:outline-edg-ink"
      @keydown.space.prevent="navigate('/versus')"
    >
      <span class="flex items-center gap-1" aria-hidden="true">
        <img src="/sprites/weapons/sword.png" alt="" class="size-[clamp(64px,8vw,96px)] [image-rendering:pixelated]">
        <span class="font-pixel text-sm text-edg-wine">VS</span>
        <img src="/sprites/weapons/hammer.png" alt="" class="size-[clamp(64px,8vw,96px)] -scale-x-100 [image-rendering:pixelated]">
      </span>
      <span class="font-pixel text-[clamp(24px,3vw,36px)]">VERSUS</span>
      <span class="font-retro text-[22px] text-edg-brown">Pick two balls and start a duel</span>
    </NuxtLink>

    <ul class="grid flex-[1_1_340px] auto-rows-[minmax(124px,1fr)] grid-cols-2 gap-6">
      <li v-for="link in links" :key="link.to" class="flex">
        <NuxtLink
          :to="link.to"
          class="px-btn-slate flex grow flex-col items-center justify-center gap-3.5 focus-visible:outline-edg-gold"
          @keydown.space.prevent="navigate(link.to)"
        >
          <svg width="40" height="40" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">
            <path v-for="(shape, i) in link.icon" :key="i" :fill="shape.fill" :d="shape.d" />
          </svg>
          <span class="font-pixel text-[11px] uppercase">{{ link.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
