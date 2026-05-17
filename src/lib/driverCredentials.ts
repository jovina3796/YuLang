/**
 * Build the canonical login credentials from a driver's phone:
 *   email    = {digits}@yulang.local
 *   username = {digits}
 *   password = last 6 digits, left-padded to 6 if shorter
 * Returns null if phone is missing or has no digits.
 *
 * Pure / sync helper — safe to import from both server and client code.
 */
export function deriveDriverCredentials(phone: string | null): {
  email: string; username: string; password: string
} | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return null
  const password = digits.length >= 6 ? digits.slice(-6) : digits.padStart(6, '0')
  return {
    email:    `${digits}@yulang.local`,
    username: digits,
    password,
  }
}
