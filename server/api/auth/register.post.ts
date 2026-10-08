import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db/client'
import { users } from '~/server/db/schema'
import { DEFAULT_ROLE } from '~/server/utils/permissions'
import { isValidUsername } from '~/server/utils/validateUsername'
import { validatePasswordLength } from '~/server/utils/validatePassword'

/**
 * POST /api/auth/register — Requirements 2.1–2.9.
 *
 * TODO (BEFORE PUBLIC DEPLOYMENT): the default role assigned here MUST become
 * `viewer` (see DEFAULT_ROLE in server/utils/permissions.ts). Registering every
 * visitor as `superuser` is a development-only convenience (Req 2.9).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ username?: unknown; password?: unknown }>(event)

  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  // Missing-field validation naming each (Req 2.5).
  const missing: string[] = []
  if (!username) missing.push('username')
  if (!password) missing.push('password')
  if (missing.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Missing required field(s): ${missing.join(', ')}.`,
    })
  }

  // Username syntax (Req 2.6).
  if (!isValidUsername(username)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username must be 3–20 letters, digits or underscores.',
    })
  }

  // Password length 8–72 (Req 2.7).
  const pw = validatePasswordLength(password)
  if (!pw.valid) {
    throw createError({ statusCode: 400, statusMessage: pw.error })
  }

  const db = useDb()

  // Reject duplicate username, create no row (Req 2.4).
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
  if (existing.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Username is already taken.',
    })
  }

  // Store only the hash (Req 2.1, 2.3). created_at defaults to server UTC now.
  const passwordHash = await hashPassword(password)
  const [created] = await db
    .insert(users)
    .values({ username, passwordHash, role: DEFAULT_ROLE }) // superuser (Req 2.2)
    .returning({ id: users.id, username: users.username, role: users.role })

  if (!created) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create user.' })
  }

  // Establish authenticated session (Req 2.8).
  await setUserSession(event, {
    user: { id: created.id, username: created.username, role: created.role },
  })

  return { id: created.id, username: created.username, role: created.role }
})
