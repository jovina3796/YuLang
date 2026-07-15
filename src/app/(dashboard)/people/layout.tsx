import { headers } from 'next/headers'
// 🌟 1. 補上 BellRing 鈴鐺圖示
import { Users, UserCog, ShieldCheck, BellRing } from 'lucide-react' 
import { getCurrentProfile } from '@/lib/auth'
import { loadRolePermissions } from '@/lib/rolePermissions.server'
import { resolveAllowedPages } from '@/lib/permissions'
import SubNavTabs from '@/components/SubNavTabs'

// 🌟 2. 擴充 Key 型別
type Key = 'drivers' | 'users' | 'permissions' | 'reminders' 

export default async function PeopleLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  const { pages } = await loadRolePermissions()
  const allowed = profile
    ? resolveAllowedPages(profile, pages)
    : new Set<string>()

  const pathname = (await headers()).get('x-pathname') ?? ''
  
  // 🌟 3. 新增 activeKey 判斷
  const activeKey: Key =
    pathname.startsWith('/people/users')       ? 'users' :
    pathname.startsWith('/people/permissions') ? 'permissions' :
    pathname.startsWith('/people/reminders')   ? 'reminders' : 
    'drivers'

  const tabs = [
    { key: 'drivers'     as const, label: '司機資料', icon: <Users size={14} strokeWidth={1.8} />,       href: '/people/drivers',     hidden: !allowed.has('/people/drivers') },
    { key: 'users'       as const, label: '登入帳號', icon: <UserCog size={14} strokeWidth={1.8} />,     href: '/people/users',       hidden: !allowed.has('/people/users') },
    { key: 'permissions' as const, label: '權限設定', icon: <ShieldCheck size={14} strokeWidth={1.8} />, href: '/people/permissions', hidden: !allowed.has('/people/permissions') },
    // 🌟 4. 新增定時提醒分頁籤
    { key: 'reminders'   as const, label: '定時提醒設定', icon: <BellRing size={14} strokeWidth={1.8} />,    href: '/people/reminders',   hidden: !allowed.has('/people/reminders') },
  ]

  return (
    <div>
      <SubNavTabs<Key> basePath="/people" tabs={tabs} activeTab={activeKey} />
      {children}
    </div>
  )
}
