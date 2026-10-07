import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db/client'
import { users } from '~/server/db/schema'

/**
 * POST /api/auth/login — Requirements 3.1, 3.2, 3.3.
 * On bad email OR password returns a single generic error that does not
 * disclose which was wrong (Req 3.2).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; password?: unknown }>(event)

  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  // Missing-field validation naming each (Req 3.3).
  const missing: string[] = []
  if (!email) missing.push('email')
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
      role: users.role,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  const genericError = () =>
    createError({ statusCode: 401, statusMessage: 'Invalid email or password.' })

  // Do not disclose whether email or password was wrong (Req 3.2).
  if (!user) {
    throw genericError()
  }
  const ok = await verifyPassword(user.passwordHash, password)
  if (!ok) {
    throw genericError()
  }

  await setUserSession(event, { user: { id: user.id, role: user.role } })
  return { id: user.id, role: user.role }
})
