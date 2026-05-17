import 'server-only'
import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/service'

export type RoleRow = {
  key:         string
  label:       string
  badge_class: string
  is_builtin:  boolean
  sort_order:  number
}

const FALLBACK_ROLES: RoleRow[] = [
  { key: 'admin',  label: '管理員', badge_class: 'badge-blue',  is_builtin: true, sort_order: 0 },
  { key: 'driver', label: '司機',   badge_class: 'badge-green', is_builtin: true, sort_order: 1 },
]

export const loadRoles = cache(async (): Promise<RoleRow[]> => {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('roles')
      .select('key, label, badge_class, is_builtin, sort_order')
      .order('sort_order', { ascending: true })
      .order('key',        { ascending: true })
    if (error || !data?.length) return FALLBACK_ROLES
    return data as RoleRow[]
  } catch {
    return FALLBACK_ROLES
  }
})

export const loadRoleMap = cache(async (): Promise<Record<string, RoleRow>> => {
  const list = await loadRoles()
  const map: Record<string, RoleRow> = {}
  for (const r of list) map[r.key] = r
  return map
})
