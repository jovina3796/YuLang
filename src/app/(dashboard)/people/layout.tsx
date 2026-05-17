import { headers } from 'next/headers'
import { Users, UserCog, ShieldCheck } from 'lucide-react'
import { getCurrentProfile } from '@/lib/auth'
import { loadRolePermissions } from '@/lib/rolePermissions.server'
import { resolveAllowedPages } from '@/lib/permissions'
import SubNavTabs from '@/components/SubNavTabs'

type Key = 'drivers' | 'users' | 'permissions'

export default async function PeopleLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  const { pages } = await loadRolePermissions()
  const allowed = profile
    ? resolveAllowedPages(profile, pages)
    : new Set<string>()

  const pathname = (await headers()).get('x-pathname') ?? ''
  const activeKey: Key =
    pathname.startsWith('/people/users')       ? 'users' :
    pathname.startsWith('/people/permissions') ? 'permissions' :
    'drivers'

  const tabs = [
    { key: 'drivers'     as const, label: '司機資料', Icon: Users,        href: '/people/drivers',     hidden: !allowed.has('/people/drivers') },
    { key: 'users'       as const, label: '登入帳號', Icon: UserCog,      href: '/people/users',       hidden: !allowed.has('/people/users') },
    { key: 'permissions' as const, label: '權限設定', Icon: ShieldCheck,  href: '/people/permissions', hidden: !allowed.has('/people/permissions') },
  ]

  return (
    <div>
      <SubNavTabs<Key> basePath="/people" tabs={tabs} activeTab={activeKey} />
      {children}
    </div>
  )
}
