import 'server-only'
import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import {
  ROLE_DEFAULTS_FALLBACK,
  DASHBOARD_SECTIONS_FALLBACK,
  type RoleDefaults,
  type RoleDashboardSections,
  type DashboardSection,
} from '@/lib/permissions'
import type { Role } from '@/lib/auth'
import { loadRoles } from '@/lib/roles.server'

export type RolePermissionsState = {
  pages:    RoleDefaults
  sections: RoleDashboardSections
}

/**
 * Single source of truth for both per-role page allow-set and dashboard
 * section visibility. One DB hit per request thanks to React `cache`.
 * Falls back to static defaults on error / missing rows.
 */
export const loadRolePermissions = cache(async (): Promise<RolePermissionsState> => {
  try {
    const supabase = createServiceClient()
    const [{ data }, roles] = await Promise.all([
      supabase
        .from('role_permissions')
        .select('role, allowed_pages, allowed_dashboard_sections'),
      loadRoles(),
    ])
    const pages:    RoleDefaults          = { ...ROLE_DEFAULTS_FALLBACK }
    const sections: RoleDashboardSections = { ...DASHBOARD_SECTIONS_FALLBACK }
    // Seed every known role with a safe default so callers can index any role key.
    for (const r of roles) {
      if (!(r.key in pages))    pages[r.key]    = ['/dashboard']
      if (!(r.key in sections)) sections[r.key] = []
    }
    for (const row of (data ?? [])) {
      const r = row.role as string
      if (row.allowed_pages) pages[r] = row.allowed_pages as string[]
      if (row.allowed_dashboard_sections) {
        sections[r] = row.allowed_dashboard_sections as DashboardSection[]
      }
    }
    return { pages, sections }
  } catch {
    return { pages: ROLE_DEFAULTS_FALLBACK, sections: DASHBOARD_SECTIONS_FALLBACK }
  }
})

/** Backward-compat: existing callers only need the page allow-set. */
export const loadRoleDefaults = cache(async (): Promise<RoleDefaults> => {
  const { pages } = await loadRolePermissions()
  return pages
})

/** Convenience: get a single role's visible dashboard section set. */
export async function loadDashboardSectionsFor(role: Role): Promise<Set<DashboardSection>> {
  const { sections } = await loadRolePermissions()
  return new Set<DashboardSection>((sections[role] ?? []) as readonly DashboardSection[])
}
