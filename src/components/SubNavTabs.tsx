'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

export type SubNavTabItem<K extends string = string> = {
  key:    K
  label:  string
  Icon:   LucideIcon
  href?:  string   // when set, link points here (overrides basePath/paramName)
  hidden?: boolean // when true, item is omitted from render
}

interface Props<K extends string = string> {
  basePath:  string                // e.g. '/people' (used when item has no href)
  paramName?: string               // 預設 'tab'
  tabs:      SubNavTabItem<K>[]
  activeTab: K
}

export default function SubNavTabs<K extends string = string>({
  basePath, paramName = 'tab', tabs, activeTab,
}: Props<K>) {
  const pathname = usePathname() ?? ''
  const visible = tabs.filter(t => !t.hidden)
  if (visible.length === 0) return null

  // Derive the actually-active tab from the current URL when items use
  // explicit hrefs. Falls back to the server-provided activeTab when no
  // href matches (e.g. tabs are query-string driven). Longest matching
  // href wins so /vendor-info/subroutes beats /vendor-info.
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
        const Icon = t.Icon
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
            <Icon size={14} strokeWidth={1.8} />
            <span>{t.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
