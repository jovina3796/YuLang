import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { getCurrentProfile } from '@/lib/auth'

const ADMIN_ONLY_PREFIXES = [
  '/trips', '/vehicles', '/drivers', '/people', '/schedule',
  '/fuel', '/maintenance', '/inspection',
  '/reports', '/fixed', '/misc', '/finance', '/vendors', '/rates', '/vendor-info',
  '/settings', '/users', '/payment-aliases',
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const hdrs = await headers()
  const pathname = hdrs.get('x-pathname') ?? ''
  const isAdminOnly = ADMIN_ONLY_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (isAdminOnly && profile.role !== 'admin') redirect('/dashboard')

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        role={profile.role}
        email={profile.email}
        displayName={profile.display_name}
        avatarUrl={profile.avatar_url}
        userId={profile.id}
      />
      <div style={{ marginLeft: 200, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <main style={{ padding: 24, flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
