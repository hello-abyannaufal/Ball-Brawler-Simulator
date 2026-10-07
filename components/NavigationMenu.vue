<script setup lang="ts">
interface NavLink {
  to: string
  label: string
}

const links: readonly NavLink[] = [
  { to: '/login', label: 'Login' },
  { to: '/register', label: 'Register' },
  { to: '/roulette', label: 'Roulette' },
  { to: '/versus', label: 'Versus' },
  { to: '/library', label: 'Library' },
  { to: '/recordings', label: 'Recordings' },
  { to: '/settings', label: 'Settings' },
]

const router = useRouter()

function navigate(to: string): void {
  router.push(to)
}
</script>

<template>
  <nav aria-label="Main navigation">
    <ul class="flex flex-col gap-2">
      <li v-for="link in links" :key="link.to">
        <NuxtLink
          :to="link.to"
          class="block rounded px-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          @keydown.space.prevent="navigate(link.to)"
        >
          {{ link.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
