'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ScrollText, Truck, Users, CalendarRange,
  Fuel, Wrench, ShieldCheck,
  ChartColumnIncreasing, ReceiptText, FileSpreadsheet, Building2,
  HandCoins, PlaneTakeoff, ClockArrowUp,
  Settings, LogOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import ProfileModal from './ProfileModal'
import { signOut } from '@/app/login/actions'

type NavItem  = { href: string; Icon: LucideIcon; label: string }
type NavGroup = { section: string | null; items: NavItem[] }

const nav: NavGroup[] = [
  { section: null, items: [
    { href: '/dashboard',    Icon: LayoutDashboard, label: '儀表板' },
  ]},
  { section: '車隊管理', items: [
    { href: '/trips',        Icon: ScrollText,      label: '車趟紀錄' },
    { href: '/vehicles',     Icon: Truck,           label: '車輛列表' },
    { href: '/people',       Icon: Users,           label: '人員管理' },
    { href: '/schedule',     Icon: CalendarRange,   label: '排班設定' },
  ]},
  { section: '車輛管理', items: [
    { href: '/fuel',         Icon: Fuel,            label: '加油紀錄' },
    { href: '/maintenance',  Icon: Wrench,          label: '保養維修' },
    { href: '/inspection',   Icon: ShieldCheck,     label: '驗車紀錄' },
  ]},
  { section: '財務相關', items: [
    { href: '/reports',      Icon: ChartColumnIncreasing, label: '統計報表' },
    { href: '/finance',      Icon: ReceiptText,     label: '收支報表' },
    { href: '/payroll',      Icon: FileSpreadsheet, label: '薪資單據' },
    { href: '/vendor-info',  Icon: Building2,       label: '廠商資訊' },
  ]},
  { section: '簽核項目', items: [
    { href: '/claims',       Icon: HandCoins,       label: '請款簽核' },
    { href: '/leaves',       Icon: PlaneTakeoff,    label: '請假簽核' },
    { href: '/overtimes',    Icon: ClockArrowUp,    label: '加班簽核' },
  ]},
]

interface Props {
  role:        string
  roleLabel:   string
  email:       string | null
  displayName: string | null
  avatarUrl:   string | null
  userId:      string
  allowedPages: string[]
}

export default function Sidebar({ role, roleLabel, email, displayName, avatarUrl, userId, allowedPages }: Props) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)

  const allowed = new Set(allowedPages)
  const visibleGroups = nav
    .map(g => ({
      ...g,
      items: g.items.filter(i => allowed.has(i.href)),
    }))
    .filter(g => g.items.length > 0)

  const username = displayName || email?.split('@')[0] || '使用者'
  const avatarChar = username.charAt(0).toUpperCase() || 'U'

  return (
    <aside style={{
      width: 200, minHeight: '100vh', background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 10,
    }}>
      {/* Brand */}
      <div style={{padding: '5px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', gap: '10px'}}>
        <Image src="/yl.png" alt="馭浪物流 Yulang Logistics Ltd." width={168} height={80} 
               style={{ width: '150px', height: 'auto' }}
        />
        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)'}}>
          ERP v1.0
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '6px 0', overflowY: 'auto' }}>
        {visibleGroups.map((group, gi) => (
          <div key={group.section ?? `g-${gi}`} style={{ marginBottom: 4 }}>
            {group.section && (
              <div style={{
                padding: '6px 14px 2px', fontSize: 9.5,
                color: 'var(--text3)', letterSpacing: '1.2px',
                textTransform: 'uppercase', fontFamily: 'var(--mono)',
              }}>{group.section}</div>
            )}
            {group.items.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              const Icon = item.Icon
              return (
                <Link key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 16px', fontSize: 13,
                  color: active ? 'var(--accent2)' : 'var(--text2)',
                  background: active ? 'rgba(46,160,67,.08)' : 'transparent',
                  borderLeft: `2px solid ${active ? 'var(--accent2)' : 'transparent'}`,
                  textDecoration: 'none', transition: 'all .15s',
                }}>
                  <Icon size={15} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div style={{
        padding: '8px 12px', borderTop: '1px solid var(--border)',
        fontSize: 12, color: 'var(--text3)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <button
          onClick={() => setProfileOpen(true)}
          title="管理個人資料"
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            padding: 0, background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'inherit', textAlign: 'left',
            minWidth: 0,
          }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'var(--bg4)', border: '1px solid var(--border2)',
            overflow: 'hidden', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: 'var(--text2)', flexShrink: 0,
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : avatarChar}
          </div>
          <div style={{ flex: 1, lineHeight: 1.2, minWidth: 0 }}>
            <div style={{ color: 'var(--text2)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username}</div>
            <div style={{ fontSize: 9.5, fontFamily: 'var(--mono)' }}>{roleLabel}</div>
          </div>
        </button>
        <form action={signOut}>
          <button type="submit" className="icon-btn" title="登出"
                  style={{ width: 24, height: 24 }}>
            <LogOut size={12} />
          </button>
        </form>
      </div>

      {/* Toolbar: settings (admin only) | theme toggle (right) */}
      <div style={{
        padding: '6px 10px', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {allowed.has('/settings') ? (
          <Link href="/settings" title="設定" style={{
            width: 28, height: 28, padding: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text2)',
            textDecoration: 'none',
          }}>
            <Settings size={14} />
          </Link>
        ) : <span />}
        <ThemeToggle />
      </div>

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        me={{
          id: userId,
          email,
          role,
          display_name: displayName,
          avatar_url: avatarUrl,
        }}
      />
    </aside>
  )
}
