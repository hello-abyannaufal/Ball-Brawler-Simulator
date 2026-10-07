import { DEFAULT_ROLE as SHARED_DEFAULT_ROLE } from '~/shared/roles'
import type { Role } from '~/shared/roles'

export type Permission = string

export interface AuthedUser {
  id: string
  role: Role
}

/**
 * The role assigned to newly registered users (re-exported from the shared
 * single source of truth so server and client never drift).
 *
 * TODO (BEFORE PUBLIC DEPLOYMENT): default role MUST become `viewer`, and a
 * real permission map MUST be defined in `can` below. While this constant is
 * not `viewer`, the app renders a visible not-ready-for-deployment banner on
 * every page (Req 4.7, 17.6).
 */
export const DEFAULT_ROLE: Role = SHARED_DEFAULT_ROLE

/**
 * Central authorization decision. All access decisions MUST route through this
 * function (Req 4.3, 4.6).
 *
 * - `superuser` is granted every permission (Req 4.4).
 * - Any other role grants nothing until a real permission map exists; it never
 *   returns true for a permission not explicitly granted (Req 4.5).
 */
export function can(user: AuthedUser, _permission: Permission): boolean {
  if (user.role === 'superuser') return true // Req 4.4
  return false // viewer grants nothing until a real map exists (Req 4.5)
}
