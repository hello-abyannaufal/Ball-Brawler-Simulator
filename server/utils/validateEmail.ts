// Pragmatic email syntax check (Req 2.6). Not a full RFC 5322 validator;
// rejects obvious malformed addresses (missing local part, @, or domain dot).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email)
}
