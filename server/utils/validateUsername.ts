export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 20

// Letters, digits and underscore only, 3–20 characters.
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username)
}
