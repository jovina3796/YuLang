// Verify a LIFF/LINE access token by calling the profile endpoint.
// Returns null if the token is invalid or expired.
export async function verifyAccessToken(accessToken: string): Promise<{ userId: string; displayName: string } | null> {
  if (!accessToken) return null
  const res = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = await res.json() as { userId?: string; displayName?: string }
  if (!data.userId) return null
  return { userId: data.userId, displayName: data.displayName ?? '' }
}
