'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface Props {
  field: string
  defaultField?: string
  defaultDir?: 'asc' | 'desc'
  initialDescFor?: string[]
  align?: 'left' | 'right' | 'center'
  width?: number
  children: React.ReactNode
}

export default function SortableTh({
  field,
  defaultField = 'departed_at',
  defaultDir   = 'desc',
  initialDescFor = ['departed_at', 'final_fare', 'created_at', 'logged_at', 'serviced_at', 'mileage'],
  align = 'center',
  width,
  children,
}: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const curSort = searchParams.get('sort') ?? defaultField
  const curDir  = searchParams.get('dir')  ?? defaultDir
  const active  = curSort === field
  const arrow   = active ? (curDir === 'asc' ? '▲' : '▼') : '↕'

  function toggle() {
    const params = new URLSearchParams(searchParams.toString())
    let nextDir: 'asc' | 'desc' = 'asc'
    if (active) nextDir = curDir === 'asc' ? 'desc' : 'asc'
    else        nextDir = initialDescFor.includes(field) ? 'desc' : 'asc'
    params.set('sort', field)
    params.set('dir', nextDir)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <th
      onClick={toggle}
      style={{
        width,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        <span style={{
          fontSize: 9,
          color: active ? 'var(--accent2)' : 'var(--text3)',
          opacity: active ? 1 : 0.5,
        }}>{arrow}</span>
      </span>
    </th>
  )
}
