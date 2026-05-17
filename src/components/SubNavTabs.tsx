'use client'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

export type SubNavTabItem<K extends string = string> = {
  key:   K
  label: string
  Icon:  LucideIcon
}

interface Props<K extends string = string> {
  basePath:  string                // e.g. '/people'
  paramName?: string               // 預設 'tab'
  tabs:      SubNavTabItem<K>[]
  activeTab: K
}

export default function SubNavTabs<K extends string = string>({
  basePath, paramName = 'tab', tabs, activeTab,
}: Props<K>) {
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
            href={`${basePath}?${paramName}=${t.key}`}
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
