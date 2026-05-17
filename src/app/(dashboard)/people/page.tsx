import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'
import { loadRolePermissions } from '@/lib/rolePermissions.server'
import { resolveAllowedPages } from '@/lib/permissions'

const ORDER = ['/people/drivers', '/people/users', '/people/permissions'] as const

export default async function PeopleIndex() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  const { pages } = await loadRolePermissions()
  const allowed = resolveAllowedPages(profile, pages)
  const target = ORDER.find(h => allowed.has(h)) ?? '/dashboard'
  redirect(target)
}

