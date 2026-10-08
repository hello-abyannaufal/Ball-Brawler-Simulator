import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db/client'
import { users } from '~/server/db/schema'

/**
 * POST /api/auth/login — Requirements 3.1, 3.2, 3.3.
 * On bad username OR password returns a single generic error that does not
 * disclose which was wrong (Req 3.2).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ username?: unknown; password?: unknown }>(event)

  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  // Missing-field validation naming each (Req 3.3).
  const missing: string[] = []
  if (!username) missing.push('username')
  if (!password) missing.push('password')
  if (missing.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Missing required field(s): ${missing.join(', ')}.`,
    })
  }

  const db = useDb()
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  const genericError = () =>
    createError({ statusCode: 401, statusMessage: 'Invalid username or password.' })

  // Do not disclose whether username or password was wrong (Req 3.2).
  if (!user) {
    throw genericError()
  }
  const ok = await verifyPassword(user.passwordHash, password)
  if (!ok) {
    throw genericError()
  }

  await setUserSession(event, {
    user: { id: user.id, username: user.username, role: user.role },
  })
  return { id: user.id, username: user.username, role: user.role }
})
