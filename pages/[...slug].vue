<script setup lang="ts">
const event = useRequestEvent()
if (event) {
  setResponseStatus(event, 404)
}
</script>

<template>
  <main class="p-6">
    <h1 class="text-2xl font-bold">
      Page not found
    </h1>
    <p class="mt-2">
      The route you requested does not exist.
    </p>
  </main>
</template>
