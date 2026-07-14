'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'

type Vendor = { id: string; name: string; warehouse: string | null }

export default function TripDateFilter({ vendors }: { vendors: Vendor[] }) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const [from,     setFrom]     = useState(searchParams.get('from')   ?? '')
  const [to,       setTo]       = useState(searchParams.get('to')     ?? '')
  const [vendorId, setVendorId] = useState(searchParams.get('vendor') ?? '')

  // Re-sync local fields if the URL changes externally (e.g. browser back/forward)
  useEffect(() => {
    setFrom(searchParams.get('from') ?? '')
    setTo(searchParams.get('to') ?? '')
    setVendorId(searchParams.get('vendor') ?? '')
  }, [searchParams])

  function buildHref(next: { from: string; to: string; vendor: string }, resetPage = true) {
    const params = new URLSearchParams(searchParams.toString())
    const set = (k: string, v: string) => {
      if (v) params.set(k, v); else params.delete(k)
    }
    set('from',   next.from)
    set('to',     next.to)
    set('vendor', next.vendor)
    if (resetPage) params.delete('page')
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  function ymdTaipei(d: Date): string {
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  }

  function applyQuickRange(days: number) {
    const todayStr = ymdTaipei(new Date())
    const [y, m, d] = todayStr.split('-').map(Number)
    const start = new Date(Date.UTC(y, m - 1, d))
    start.setUTCDate(start.getUTCDate() - (days - 1))
    const pad = (n: number) => String(n).padStart(2, '0')
    const fStr = `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}`
    
    setFrom(fStr)
    setTo(todayStr)
    // 🌟 優化：點擊快捷按鈕後，立刻自動送出查詢，不用再按一次 Search 按鈕！
    router.push(buildHref({ from: fStr, to: todayStr, vendor: vendorId }))
  }

  function applyThisMonth() {
    const todayStr = ymdTaipei(new Date())
    const fStr = `${todayStr.slice(0, 7)}-01`
    
    setFrom(fStr)
    setTo(todayStr)
    // 🌟 優化：點擊快捷按鈕後，立刻自動送出查詢！
    router.push(buildHref({ from: fStr, to: todayStr, vendor: vendorId }))
  }

  function submitFilter() {
    router.push(buildHref({ from, to, vendor: vendorId }))
  }

  function clearFilter() {
    setFrom(''); setTo(''); setVendorId('')
    router.push(buildHref({ from: '', to: '', vendor: '' }))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (e.key === 'Enter') { e.preventDefault(); submitFilter() }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        type="date" className="input" style={{ width: 150 }}
        value={from} max={to || undefined}
        onChange={e => setFrom(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <span style={{ color: 'var(--text3)', fontSize: 12 }}>～</span>
      <input
        type="date" className="input" style={{ width: 150 }}
        value={to} min={from || undefined}
        onChange={e => setTo(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <button type="button" className="btn btn-sm" onClick={() => applyQuickRange(7)}>近 7 天</button>
      <button type="button" className="btn btn-sm" onClick={() => applyQuickRange(30)}>近 30 天</button>
      <button type="button" className="btn btn-sm" onClick={applyThisMonth}>本月</button>
      <select
        className="input" style={{ width: 180 }}
        value={vendorId}
        onChange={e => setVendorId(e.target.value)}
        onKeyDown={onKeyDown}
      >
        <option value="">全部廠商</option>
        {vendors.map(v => (
          <option key={v.id} value={v.id}>
            {v.name}{v.warehouse ? `／${v.warehouse}` : ''}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-sm btn-primary"
        onClick={submitFilter}
        title="查詢"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <Search size={14} /> 查詢
      </button>
      <button
        type="button"
        className="btn btn-sm"
        onClick={clearFilter}
        title="清除篩選"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text3)' }}
      >
        <X size={14} /> 清除
      </button>
    </div>
  )
}
