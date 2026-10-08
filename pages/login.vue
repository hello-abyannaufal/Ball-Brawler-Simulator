<script setup lang="ts">
// Already signed in: the login popup has nothing to do, go Home.
definePageMeta({
  middleware: () => {
    const { loggedIn } = useUserSession()
    if (loggedIn.value) {
      return navigateTo('/')
    }
  },
})
</script>

<template>
  <SplashScreen>
    <LoginDialog />
  </SplashScreen>
</template>
