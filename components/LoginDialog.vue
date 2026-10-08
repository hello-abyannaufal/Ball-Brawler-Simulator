<script setup lang="ts">
const { fetch: refreshSession } = useUserSession()

const username = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)
const usernameInput = ref<HTMLInputElement | null>(null)

onMounted(() => usernameInput.value?.focus())

function close(): void {
  navigateTo('/')
}

async function submit(): Promise<void> {
  if (submitting.value) return
  error.value = ''
  submitting.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    })
    await refreshSession()
    await navigateTo('/')
  }
  catch (err) {
    const e = err as { data?: { statusMessage?: string }, statusMessage?: string }
    error.value = e.data?.statusMessage ?? e.statusMessage ?? 'Login failed. Try again.'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-30 flex items-center justify-center bg-edg-ink/80 p-6">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
      class="px-frame w-full max-w-[420px] bg-edg-slate font-retro text-white shadow-[inset_0_0_0_4px_#8b9bb4]"
      @keydown.esc="close"
    >
      <div class="flex items-center justify-between bg-edg-gold py-1 pl-5 pr-1 shadow-[inset_0_-4px_0_#f77622,inset_0_4px_0_#fee761]">
        <h2 id="login-title" class="font-pixel text-base text-edg-ink">
          LOGIN
        </h2>
        <button
          type="button"
          aria-label="Close"
          class="flex size-11 items-center justify-center bg-edg-ink"
          @click="close"
        >
          <svg width="20" height="20" viewBox="0 0 5 5" shape-rendering="crispEdges" aria-hidden="true">
            <path fill="#ffffff" d="M0 0h1v1h-1zM4 0h1v1h-1zM1 1h1v1h-1zM3 1h1v1h-1zM2 2h1v1h-1zM1 3h1v1h-1zM3 3h1v1h-1zM0 4h1v1h-1zM4 4h1v1h-1z" />
          </svg>
        </button>
      </div>

      <form class="flex flex-col gap-5 px-6 pb-7 pt-6" novalidate @submit.prevent="submit">
        <p class="text-[22px] leading-tight text-edg-fog">
          Welcome back, brawler.
        </p>

        <div class="flex flex-col gap-2">
          <label for="login-username" class="font-pixel text-[10px] text-edg-sand">USERNAME</label>
          <input
            id="login-username"
            ref="usernameInput"
            v-model="username"
            type="text"
            autocomplete="username"
            autocapitalize="off"
            spellcheck="false"
            required
            class="h-12 bg-edg-night px-3 text-2xl text-white shadow-[inset_4px_4px_0_#181425,0_0_0_4px_#5a6988] placeholder:text-edg-mist"
          >
        </div>

        <div class="flex flex-col gap-2">
          <label for="login-password" class="font-pixel text-[10px] text-edg-sand">PASSWORD</label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            class="h-12 bg-edg-night px-3 text-2xl text-white shadow-[inset_4px_4px_0_#181425,0_0_0_4px_#5a6988]"
          >
        </div>

        <p
          v-if="error"
          role="alert"
          class="bg-edg-ink px-3 py-2 text-xl text-edg-sun"
        >
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="submitting"
          class="px-btn-green mt-2 flex h-14 items-center justify-center font-pixel text-base disabled:opacity-70"
        >
          {{ submitting ? '...' : 'ENTER' }}
        </button>
      </form>
    </div>
  </div>
</template>
