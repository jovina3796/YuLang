import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
