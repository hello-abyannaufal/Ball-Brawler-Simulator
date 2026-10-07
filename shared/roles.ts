export type Role = 'superuser' | 'viewer'

/**
 * Role assigned to newly registered users. Single source of truth shared by
 * server auth and the client deployment-safety banner.
 *
 * TODO (BEFORE PUBLIC DEPLOYMENT): MUST become `viewer`. While this is not
 * `viewer`, a visible not-ready-for-deployment banner renders on every page
 * (Req 4.7, 17.6).
 */
export const DEFAULT_ROLE = 'superuser' as Role

/** True while the app is not safe for public deployment (Req 17.6). */
export const NOT_DEPLOYMENT_READY: boolean = DEFAULT_ROLE !== 'viewer'
