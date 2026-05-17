'use client'
import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleRestDay, bulkSetRestDays } from '@/app/(dashboard)/schedule/actions'

interface Driver { id: string; name: string }

interface Props {
  year:    number
  month:   number  // 0-indexed
  drivers: Driver[]
  /** { driverId: { 'YYYY-MM-DD': shift } } */
  shiftMap: Record<string, Record<string, string>>
}

const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六']

function pad(n: number) { return String(n).padStart(2, '0') }
function isoDate(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

function parseDateList(input: string, year: number, month: number): string[] {
  // Accepts: "5/15, 5/22, 5/29", "5/15-5/17", "15, 22, 29" (uses current month), full ISO
  // Returns deduped sorted ISO date strings clipped to month range.
  const out = new Set<string>()
  const monthEnd = new Date(year, month + 1, 0).getDate()

  const addIso = (iso: string) => {
    const [yStr, mStr, dStr] = iso.split('-').map(Number)
    if (!yStr || !mStr || !dStr) return
    const d = new Date(yStr, mStr - 1, dStr)
    if (d.getMonth() !== mStr - 1) return
    out.add(`${yStr}-${pad(mStr)}-${pad(dStr)}`)
  }

  const parseToken = (tok: string) => {
    tok = tok.trim()
    if (!tok) return
    // Full ISO
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(tok)) {
      const [y, m, d] = tok.split('-').map(Number)
      addIso(isoDate(y, m - 1, d))
      return
    }
    // M/D
    if (/^\d{1,2}\/\d{1,2}$/.test(tok)) {
      const [m, d] = tok.split('/').map(Number)
      addIso(isoDate(year, m - 1, d))
      return
    }
    // Just a day number — use current month
    if (/^\d{1,2}$/.test(tok)) {
      const d = Number(tok)
      if (d >= 1 && d <= monthEnd) addIso(isoDate(year, month, d))
      return
    }
  }

  // Split by comma / 全形 comma / 頓號 / space
  const segments = input.split(/[,，、\s]+/).filter(Boolean)
  for (const seg of segments) {
    // Range: A-B or A~B
    const rangeMatch = seg.match(/^(\S+?)\s*[-~]\s*(\S+)$/)
    if (rangeMatch) {
      const [, a, b] = rangeMatch
      // Resolve both to Date objects in same month if shorthand
      const resolve = (t: string): Date | null => {
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) {
          const [y, m, d] = t.split('-').map(Number)
          return new Date(y, m - 1, d)
        }
        if (/^\d{1,2}\/\d{1,2}$/.test(t)) {
          const [m, d] = t.split('/').map(Number)
          return new Date(year, m - 1, d)
        }
        if (/^\d{1,2}$/.test(t)) return new Date(year, month, Number(t))
        return null
      }
      const da = resolve(a), db = resolve(b)
      if (da && db && da <= db) {
        for (let d = new Date(da); d <= db; d.setDate(d.getDate() + 1)) {
          addIso(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
        }
      }
      continue
    }
    parseToken(seg)
  }
  return Array.from(out).sort()
}

export default function ScheduleCalendar({ year, month, drivers, shiftMap }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [bulkDriver, setBulkDriver] = useState('')
  const [bulkInput, setBulkInput] = useState('')
  const [busy, setBusy] = useState(false)

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month])
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth])

  function onCellClick(driverId: string, date: string) {
    setBusy(true)
    startTransition(async () => {
      const { error } = await toggleRestDay(driverId, date)
      setBusy(false)
      if (error) { alert(`更新失敗：${error}`); return }
      router.refresh()
    })
  }

  async function onBulkSubmit() {
    if (!bulkDriver) { alert('請先選擇司機'); return }
    const dates = parseDateList(bulkInput, year, month)
    if (dates.length === 0) { alert('未解析到有效日期'); return }
    if (!confirm(`將為此司機新增 ${dates.length} 天排休：\n${dates.join('、')}\n是否繼續？`)) return
    setBusy(true)
    const { error, inserted } = await bulkSetRestDays(bulkDriver, dates)
    setBusy(false)
    if (error) { alert(`更新失敗：${error}`); return }
    alert(`已新增 ${inserted} 天排休（${dates.length - inserted} 天已存在）`)
    setBulkInput('')
    router.refresh()
  }

  function shiftMonth(delta: number) {
    const total = year * 12 + month + delta
    const ny = Math.floor(total / 12)
    const nm = ((total % 12) + 12) % 12
    const params = new URLSearchParams(window.location.search)
    params.set('ym', `${ny}-${pad(nm + 1)}`)
    router.push(`/schedule?${params.toString()}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">月曆排休</div>
            <div className="card-sub">點擊格子切換 出勤 ↔ 休</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="icon-btn" onClick={() => shiftMonth(-1)} disabled={busy}>‹</button>
            <span className="mono" style={{ fontSize: 14, fontWeight: 600, minWidth: 90, textAlign: 'center' }}>
              {year} / {pad(month + 1)} 月
            </span>
            <button className="icon-btn" onClick={() => shiftMonth(1)} disabled={busy}>›</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ tableLayout: 'fixed', width: '100%', minWidth: 120 + daysInMonth * 28 }}>
            <colgroup>
              <col style={{ width: 120 }} />
              {days.map(d => <col key={d} style={{ width: 28 }} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>司機 / 日期</th>
                {days.map(d => {
                  const wd = new Date(year, month, d).getDay()
                  const color = wd === 0 ? 'var(--red)' : wd === 6 ? 'var(--blue)' : 'var(--text3)'
                  return (
                    <th key={d} className="mono" style={{ textAlign: 'center', fontSize: 10, padding: '6px 2px', color }}>
                      {d}
                      <br />
                      <span style={{ fontSize: 9, fontWeight: 400 }}>{weekdayLabels[wd]}</span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 ? (
                <tr><td colSpan={daysInMonth + 1} style={{ textAlign: 'center', color: 'var(--text3)', padding: 18 }}>尚無在職司機</td></tr>
              ) : drivers.map(d => (
                <tr key={d.id}>
                  <td className="name" style={{ textAlign: 'center', fontSize: 12 }}>{d.name}</td>
                  {days.map(day => {
                    const iso = isoDate(year, month, day)
                    const sh = shiftMap[d.id]?.[iso]
                    const isRest = sh ? /休/.test(sh) : false
                    const hasShift = !!sh && !isRest
                    return (
                      <td
                        key={day}
                        onClick={() => onCellClick(d.id, iso)}
                        title={isRest ? '排休（點擊取消）' : hasShift ? `${sh}（點擊設為排休）` : '出勤（點擊設為排休）'}
                        style={{
                          textAlign: 'center', fontSize: 13, cursor: busy || pending ? 'wait' : 'pointer',
                          padding: '4px 0',
                          background: isRest ? 'rgba(248,81,73,.10)' : 'transparent',
                        }}
                      >
                        {isRest
                          ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>休</span>
                          : hasShift
                            ? <span className="mono" style={{ color: 'var(--accent2)', fontSize: 10 }}>{sh}</span>
                            : <span style={{ color: 'var(--accent2)', fontSize: 14 }}>●</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">批次輸入排休日期</div>
            <div className="card-sub">支援格式：5/15, 5/22、5/15-5/17、15 22 29（純數字代表本月）</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="input" value={bulkDriver} onChange={e => setBulkDriver(e.target.value)}
                  style={{ minWidth: 150 }}>
            <option value="">— 選擇司機 —</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input
            type="text" className="input" value={bulkInput}
            onChange={e => setBulkInput(e.target.value)}
            placeholder="例：5/15, 5/22, 5/29 或 5/15-5/17"
            style={{ flex: 1, minWidth: 240 }}
          />
          <button className="btn btn-primary" onClick={onBulkSubmit}
                  disabled={busy || pending || !bulkDriver || !bulkInput.trim()}>
            送出排休
          </button>
        </div>
      </div>
    </div>
  )
}
