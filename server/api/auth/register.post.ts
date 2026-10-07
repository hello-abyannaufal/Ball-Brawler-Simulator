import { eq } from 'drizzle-orm'
import { useDb } from '~/server/db/client'
import { users } from '~/server/db/schema'
import { DEFAULT_ROLE } from '~/server/utils/permissions'
import { isValidEmail } from '~/server/utils/validateEmail'
import { validatePasswordLength } from '~/server/utils/validatePassword'

/**
 * POST /api/auth/register — Requirements 2.1–2.9.
 *
 * TODO (BEFORE PUBLIC DEPLOYMENT): the default role assigned here MUST become
 * `viewer` (see DEFAULT_ROLE in server/utils/permissions.ts). Registering every
 * visitor as `superuser` is a development-only convenience (Req 2.9).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; password?: unknown }>(event)

  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  // Missing-field validation naming each (Req 2.5).
  const missing: string[] = []
  if (!email) missing.push('email')
  if (!password) missing.push('password')
  if (missing.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Missing required field(s): ${missing.join(', ')}.`,
    })
  }

  // Email syntax (Req 2.6).
  if (!isValidEmail(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email format is invalid.',
    })
  }

  // Password length 8–72 (Req 2.7).
  const pw = validatePasswordLength(password)
  if (!pw.valid) {
    throw createError({ statusCode: 400, statusMessage: pw.error })
  }

  const db = useDb()

  // Reject duplicate email, create no row (Req 2.4).
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  if (existing.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Email is already registered.',
    })
  }

  // Store only the hash (Req 2.1, 2.3). created_at defaults to server UTC now.
  const passwordHash = await hashPassword(password)
  const [created] = await db
    .insert(users)
    .values({ email, passwordHash, role: DEFAULT_ROLE }) // superuser (Req 2.2)
    .returning({ id: users.id, role: users.role })

  if (!created) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create user.' })
  }

  // Establish authenticated session (Req 2.8).
  await setUserSession(event, { user: { id: created.id, role: created.role } })

  return { id: created.id, role: created.role }
})
