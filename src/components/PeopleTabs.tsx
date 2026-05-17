'use client'
import Link from 'next/link'
import { Users, UserCog } from 'lucide-react'

interface Props {
  activeTab: 'drivers' | 'users'
}

export default function PeopleTabs({ activeTab }: Props) {
  const tabs: { key: Props['activeTab']; label: string; Icon: typeof Users }[] = [
    { key: 'drivers', label: '司機資料', Icon: Users },
    { key: 'users',   label: '登入帳號', Icon: UserCog },
  ]
  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 16,
      borderBottom: '1px solid var(--border)',
    }}>
      {tabs.map(t => {
        const active = activeTab === t.key
        const Icon = t.Icon
        return (
          <Link
            key={t.key}
            href={`/people?tab=${t.key}`}
            scroll={false}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', fontSize: 13, textDecoration: 'none',
              color: active ? 'var(--accent2)' : 'var(--text2)',
              borderBottom: `2px solid ${active ? 'var(--accent2)' : 'transparent'}`,
              marginBottom: '-1px',
              transition: 'all .15s',
            }}
          >
            <Icon size={14} strokeWidth={1.8} />
            <span>{t.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
