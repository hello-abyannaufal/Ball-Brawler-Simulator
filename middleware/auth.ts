/**
 * Protected-route middleware (Req 3.6, 4.8).
 * Prevents rendering of auth-required pages for unauthenticated visitors and
 * redirects them to /login. Apply per-page via:
 *   definePageMeta({ middleware: 'auth' })
 */
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})
