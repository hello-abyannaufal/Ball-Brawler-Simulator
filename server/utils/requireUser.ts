import type { H3Event } from 'h3'
import type { AuthedUser } from './permissions'

/**
 * Returns the authenticated User for a valid, unexpired Session (Req 4.1).
 *
 * If no Session exists (or it carries no user), rejects with a 401 and returns
 * no User, leaving server-side state unchanged (Req 4.2). Every authenticated
 * endpoint MUST route through this helper (Req 4.6).
 */
export async function requireUser(event: H3Event): Promise<AuthedUser> {
  const session = await getUserSession(event)
  const user = session?.user as AuthedUser | undefined

  if (!user || !user.id || !user.role) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthenticated' })
  }

  return { id: user.id, role: user.role }
}
