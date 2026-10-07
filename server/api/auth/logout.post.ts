/**
 * POST /api/auth/logout — clears the Session so a later load restores no
 * authenticated state (Req 3.5).
 */
export default defineEventHandler(async (event) => {
  await clearUserSession(event)
  return { ok: true }
})
