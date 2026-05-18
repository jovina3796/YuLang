'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export type SubNavTabItem<K extends string = string> = {
  key:    K
  label:  string
  icon:   ReactNode
  href?:  string
  hidden?: boolean
}

interface Props<K extends string = string> {
  basePath:  string
  paramName?: string
  tabs:      SubNavTabItem<K>[]
  activeTab: K
}

export default function SubNavTabs<K extends string = string>({
  basePath, paramName = 'tab', tabs, activeTab,
}: Props<K>) {
  const pathname = usePathname() ?? ''
  const visible = tabs.filter(t => !t.hidden)
  if (visible.length === 0) return null

  let resolvedActive: K = activeTab
  let bestMatchLen = -1
  for (const t of visible) {
    if (!t.href) continue
    if (pathname === t.href || pathname.startsWith(t.href + '/')) {
      if (t.href.length > bestMatchLen) {
        bestMatchLen = t.href.length
        resolvedActive = t.key
      }
    }
  }

  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 16,
      borderBottom: '1px solid var(--border)',
    }}>
      {visible.map(t => {
        const active = resolvedActive === t.key
        const href = t.href ?? `${basePath}?${paramName}=${t.key}`
        return (
          <Link
            key={t.key}
            href={href}
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
            {t.icon}
            <span>{t.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
