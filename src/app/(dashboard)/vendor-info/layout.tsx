import { headers } from 'next/headers'
import { Building2, Tags, MapPinned } from 'lucide-react'
import { getCurrentProfile } from '@/lib/auth'
import { loadRolePermissions } from '@/lib/rolePermissions.server'
import { resolveAllowedPages } from '@/lib/permissions'
import SubNavTabs from '@/components/SubNavTabs'

type Key = 'vendors' | 'rates' | 'subroutes'

export default async function VendorInfoLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  const { pages } = await loadRolePermissions()
  const allowed = profile
    ? resolveAllowedPages(profile, pages)
    : new Set<string>()

  const pathname = (await headers()).get('x-pathname') ?? ''
  const activeKey: Key =
    pathname.startsWith('/vendor-info/rates')     ? 'rates' :
    pathname.startsWith('/vendor-info/subroutes') ? 'subroutes' :
    'vendors'

  const tabs = [
    { key: 'vendors'   as const, label: '廠商設定',     icon: <Building2 size={14} strokeWidth={1.8} />, href: '/vendor-info/vendors',   hidden: !allowed.has('/vendor-info/vendors') },
    { key: 'rates'     as const, label: '運費設定',     icon: <Tags size={14} strokeWidth={1.8} />,      href: '/vendor-info/rates',     hidden: !allowed.has('/vendor-info/rates') },
    { key: 'subroutes' as const, label: '配送區域對應', icon: <MapPinned size={14} strokeWidth={1.8} />, href: '/vendor-info/subroutes', hidden: !allowed.has('/vendor-info/subroutes') },
  ]

  return (
    <div>
      <SubNavTabs<Key> basePath="/vendor-info" tabs={tabs} activeTab={activeKey} />
      {children}
    </div>
  )
}
