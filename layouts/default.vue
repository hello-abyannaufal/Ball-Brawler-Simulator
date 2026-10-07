<script setup lang="ts">
import { usePersistenceError } from '~/stores/example'
import { NOT_DEPLOYMENT_READY } from '~/shared/roles'

const persistenceError = usePersistenceError()
const dismissed = ref(false)

const showNotification = computed(
  () => persistenceError.value.failed && !dismissed.value,
)

function dismiss(): void {
  dismissed.value = true
}
</script>

<template>
  <div
    class="relative min-h-screen w-full overflow-x-hidden overflow-y-auto bg-white"
  >
    <div
      v-if="NOT_DEPLOYMENT_READY"
      role="alert"
      class="sticky top-0 z-20 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-black"
    >
      Not ready for public deployment: default role is not “viewer”.
    </div>

    <div
      v-if="showNotification"
      role="alert"
      class="sticky top-0 z-10 flex items-start justify-between gap-2 bg-red-600 px-4 py-2 text-sm text-white"
    >
      <span>{{ persistenceError.message }}</span>
      <button
        type="button"
        class="shrink-0 font-bold outline-none focus-visible:ring-2 focus-visible:ring-white"
        aria-label="Dismiss notification"
        @click="dismiss"
      >
        ×
      </button>
    </div>

    <slot />
  </div>
</template>
