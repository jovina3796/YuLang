import 'server-only'
import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import { ROLE_DEFAULTS_FALLBACK, type RoleDefaults } from '@/lib/permissions'
import type { Role } from '@/lib/auth'

/**
 * Loads per-role default allow-sets from role_permissions table.
 * Wrapped in React `cache` so a single request only hits the DB once.
 * Falls back to ROLE_DEFAULTS_FALLBACK on error / missing rows.
 */
export const loadRoleDefaults = cache(async (): Promise<RoleDefaults> => {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('role_permissions')
      .select('role, allowed_pages')
    const out: RoleDefaults = { ...ROLE_DEFAULTS_FALLBACK }
    for (const row of (data ?? [])) {
      const r = row.role as Role
      if (r === 'admin' || r === 'driver') {
        out[r] = (row.allowed_pages as string[]) ?? ROLE_DEFAULTS_FALLBACK[r]
      }
    }
    return out
  } catch {
    return ROLE_DEFAULTS_FALLBACK
  }
})
