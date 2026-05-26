'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function MiscDateFilter() {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const [from, setFrom] = useState(searchParams.get('from') ?? '')
  const [to,   setTo]   = useState(searchParams.get('to')   ?? '')
  const [type, setType] = useState(searchParams.get('type') ?? '')

  useEffect(() => {
    setFrom(searchParams.get('from') ?? '')
    setTo(searchParams.get('to') ?? '')
    setType(searchParams.get('type') ?? '')
  }, [searchParams])

  function apply(next: { from?: string; to?: string; type?: string }) {
    const params = new URLSearchParams(searchParams.toString())
    const set = (k: string, v: string | undefined) => {
      if (v && v.length) params.set(k, v); else params.delete(k)
    }
    set('from', next.from ?? from)
    set('to',   next.to   ?? to)
    set('type', next.type ?? type)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function ymdTaipei(d: Date): string {
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  }

  function quickRange(days: number) {
    const todayStr = ymdTaipei(new Date())
    const [y, m, d] = todayStr.split('-').map(Number)
    const start = new Date(Date.UTC(y, m - 1, d))
    start.setUTCDate(start.getUTCDate() - (days - 1))
    const pad = (n: number) => String(n).padStart(2, '0')
    const f = `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}`
    setFrom(f); setTo(todayStr); apply({ from: f, to: todayStr })
  }

  function thisMonth() {
    const todayStr = ymdTaipei(new Date())
    const fStr = `${todayStr.slice(0, 7)}-01`
    setFrom(fStr); setTo(todayStr); apply({ from: fStr, to: todayStr })
  }

  function clear() {
    setFrom(''); setTo(''); setType('')
    apply({ from: '', to: '', type: '' })
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
        className="input" style={{ width: 120 }}
        value={type}
        onChange={e => { setType(e.target.value); apply({ type: e.target.value }) }}
      >
        <option value="">全部類型</option>
        <option value="income">收入</option>
        <option value="expense">支出</option>
      </select>
      {(from || to || type) && (
        <button className="btn btn-sm" onClick={clear} style={{ color: 'var(--text3)' }}>清除</button>
      )}
    </div>
  )
}
