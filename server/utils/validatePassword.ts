export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 72

/**
 * Pure password-length validator used by registration (Req 2.7).
 * Accepts only when length is 8–72 inclusive; otherwise returns a length error.
 */
export function validatePasswordLength(password: string): {
  valid: boolean
  error?: string
} {
  const len = password.length
  if (len < PASSWORD_MIN_LENGTH || len > PASSWORD_MAX_LENGTH) {
    return {
      valid: false,
      error: `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`,
    }
  }
  return { valid: true }
}
