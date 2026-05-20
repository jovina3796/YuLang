'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

type Vendor = { id: string; name: string; warehouse: string | null }

export default function TripDateFilter({ vendors }: { vendors: Vendor[] }) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const [from,     setFrom]     = useState(searchParams.get('from')   ?? '')
  const [to,       setTo]       = useState(searchParams.get('to')     ?? '')
  const [vendorId, setVendorId] = useState(searchParams.get('vendor') ?? '')

  useEffect(() => {
    setFrom(searchParams.get('from') ?? '')
    setTo(searchParams.get('to') ?? '')
    setVendorId(searchParams.get('vendor') ?? '')
  }, [searchParams])

  function apply(next: { from?: string; to?: string; vendor?: string }) {
    const params = new URLSearchParams(searchParams.toString())
    const set = (k: string, v: string | undefined) => {
      if (v && v.length) params.set(k, v); else params.delete(k)
    }
    set('from',   next.from   ?? from)
    set('to',     next.to     ?? to)
    set('vendor', next.vendor ?? vendorId)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function ymdTaipei(d: Date): string {
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  }

  function quickRange(days: number) {
    const end   = new Date()
    const start = new Date()
    start.setDate(end.getDate() - (days - 1))
    const f = ymdTaipei(start)
    const t = ymdTaipei(end)
    setFrom(f); setTo(t); apply({ from: f, to: t })
  }

  function thisMonth() {
    const now = new Date()
    const f = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0)
    const fStr = ymdTaipei(f)
    const tStr = ymdTaipei(now)
    setFrom(fStr); setTo(tStr); apply({ from: fStr, to: tStr })
  }

  function clear() {
    setFrom(''); setTo(''); setVendorId('')
    apply({ from: '', to: '', vendor: '' })
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        type="date" className="input" style={{ width: 150 }}
        value={from} max={to || undefined}
        onChange={e => setFrom(e.target.value)}
        onBlur={() => apply({})}
      />
      <span style={{ color: 'var(--text3)', fontSize: 12 }}>～</span>
      <input
        type="date" className="input" style={{ width: 150 }}
        value={to} min={from || undefined}
        onChange={e => setTo(e.target.value)}
        onBlur={() => apply({})}
      />
      <button className="btn btn-sm" onClick={() => quickRange(7)}>近 7 天</button>
      <button className="btn btn-sm" onClick={() => quickRange(30)}>近 30 天</button>
      <button className="btn btn-sm" onClick={thisMonth}>本月</button>
      <select
        className="input" style={{ width: 180 }}
        value={vendorId}
        onChange={e => { setVendorId(e.target.value); apply({ vendor: e.target.value }) }}
      >
        <option value="">全部廠商</option>
        {vendors.map(v => (
          <option key={v.id} value={v.id}>
            {v.name}{v.warehouse ? `／${v.warehouse}` : ''}
          </option>
        ))}
      </select>
      {(from || to || vendorId) && (
        <button className="btn btn-sm" onClick={clear} style={{ color: 'var(--text3)' }}>清除</button>
      )}
    </div>
  )
}
