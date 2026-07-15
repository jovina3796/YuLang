import { headers } from 'next/headers'
import { getCurrentProfile } from '@/lib/auth'
import { loadRolePermissions } from '@/lib/rolePermissions.server'
import { resolveAllowedPages } from '@/lib/permissions'
import SubNavTabs from '@/components/SubNavTabs'
// 🌟 已經移除 BellRing 圖示
import { Building2, Tags, MapPinned, Percent } from 'lucide-react'

// 🌟 已經移除 'reminders'
type Key = 'vendors' | 'rates' | 'subroutes' | 'driver-rates' | 'surcharges'

export default async function VendorInfoLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  const { pages } = await loadRolePermissions()
  const allowed = profile
    ? resolveAllowedPages(profile, pages)
    : new Set<string>()

  const pathname = (await headers()).get('x-pathname') ?? ''
  
  // 🌟 已經移除 reminders 的路由判斷
  const activeKey: Key =
    pathname.startsWith('/vendor-info/rates')        ? 'rates' :
    pathname.startsWith('/vendor-info/subroutes')    ? 'subroutes' :
    pathname.startsWith('/vendor-info/driver-rates') ? 'driver-rates' :
    pathname.startsWith('/vendor-info/surcharges')   ? 'surcharges' :
    'vendors'

  const tabs = [
    { key: 'vendors'      as const, label: '廠商設定',     icon: <Building2 size={14} strokeWidth={1.8} />, href: '/vendor-info/vendors',      hidden: !allowed.has('/vendor-info/vendors') },
    { key: 'rates'        as const, label: '運費設定',     icon: <Tags size={14} strokeWidth={1.8} />,      href: '/vendor-info/rates',        hidden: !allowed.has('/vendor-info/rates') },
    { key: 'subroutes'    as const, label: '配送區域對應', icon: <MapPinned size={14} strokeWidth={1.8} />, href: '/vendor-info/subroutes',    hidden: !allowed.has('/vendor-info/subroutes') },
    { key: 'driver-rates' as const, label: '例外抽成設定', icon: <Percent size={14} strokeWidth={1.8} />,   href: '/vendor-info/driver-rates', hidden: !allowed.has('/vendor-info/rates') },
    { key: 'surcharges'   as const, label: '特殊加成設定', icon: <Percent size={14} strokeWidth={1.8} />,   href: '/vendor-info/surcharges',   hidden: !allowed.has('/vendor-info/rates') },
    // 🌟 reminders 頁籤已經徹底刪除
  ]

  return (
    <div>
      <SubNavTabs<Key> basePath="/vendor-info" tabs={tabs} activeTab={activeKey} />
      {children}
    </div>
  )
}
