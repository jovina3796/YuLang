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

  function quickRange(days: number) {
    const end   = new Date()
    const start = new Date()
    start.setDate(end.getDate() - (days - 1))
    const f = start.toISOString().split('T')[0]
    const t = end.toISOString().split('T')[0]
    setFrom(f); setTo(t); apply({ from: f, to: t })
  }

  function thisMonth() {
    const now = new Date()
    const f = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const t = now.toISOString().split('T')[0]
    setFrom(f); setTo(t); apply({ from: f, to: t })
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
