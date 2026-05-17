'use client'
import { useMemo, useState } from 'react'
import { Solar } from 'lunar-typescript'

export type Marker = { date: string; color: string; label?: string }

interface Props {
  markers?: Marker[]
}

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']
const weekendIdx = { sat: 5, sun: 6 }

function lunarDay(y: number, m: number, d: number): string {
  try {
    const solar = Solar.fromYmd(y, m, d)
    const lunar = solar.getLunar()
    // Show 月名+日 on day-1, otherwise just day name
    if (lunar.getDay() === 1) return lunar.getMonthInChinese() + '月'
    return lunar.getDayInChinese()
  } catch {
    return ''
  }
}

function fmtTw(iso: string) {
  return iso.slice(5).replace('-', '/')
}

export default function DashboardCalendar({ markers = [] }: Props) {
  const today = useMemo(() => new Date(), [])
  const [view, setView] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }))
  const [mode, setMode] = useState<'calendar' | 'todo'>('calendar')

  const markerMap = useMemo(() => {
    const m: Record<string, Marker[]> = {}
    markers.forEach(k => { (m[k.date] ??= []).push(k) })
    return m
  }, [markers])

  const sortedMarkers = useMemo(() => {
    return [...markers]
      .filter(k => k.label)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [markers])

  // Build cells with Monday-first
  const first = new Date(view.y, view.m, 1)
  const startWeekdayMonFirst = (first.getDay() + 6) % 7 // Mon=0..Sun=6
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const prevMonthDays = new Date(view.y, view.m, 0).getDate()

  const cells: { y: number; m: number; d: number; outside: boolean }[] = []
  for (let i = 0; i < startWeekdayMonFirst; i++) {
    cells.push({ y: view.y, m: view.m - 1, d: prevMonthDays - startWeekdayMonFirst + 1 + i, outside: true })
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ y: view.y, m: view.m, d, outside: false })
  while (cells.length % 7 !== 0) {
    const next = cells.length - startWeekdayMonFirst - daysInMonth + 1
    cells.push({ y: view.y, m: view.m + 1, d: next, outside: true })
  }

  const shift = (delta: number) => {
    const total = view.y * 12 + view.m + delta
    setView({ y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 })
  }
  const backToday = () => setView({ y: today.getFullYear(), m: today.getMonth() })
  const isToday = (y: number, m: number, d: number) =>
    y === today.getFullYear() && m === today.getMonth() && d === today.getDate()

  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <button onClick={() => shift(-1)} className="icon-btn" style={{ width: 26, height: 26 }}>‹</button>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 600 }}>
          {view.y} / {String(view.m + 1).padStart(2, '0')} 月
        </div>
        <button onClick={() => shift(1)} className="icon-btn" style={{ width: 26, height: 26 }}>›</button>
      </div>

      {mode === 'calendar' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
            {weekdayLabels.map((w, i) => (
              <div key={w} style={{
                textAlign: 'center', fontSize: 11, padding: '4px 0',
                color: i === weekendIdx.sun ? 'var(--red)' : i === weekendIdx.sat ? 'var(--blue)' : 'var(--text3)',
              }}>{w}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, flex: 1 }}>
            {cells.map((c, i) => {
              const iso = `${c.y}-${String(c.m + 1).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`
              const cellMarkers = markerMap[iso] ?? []
              const todayCell = !c.outside && isToday(c.y, c.m, c.d)
              const weekday = i % 7
              return (
                <div
                  key={i}
                  title={cellMarkers.map(m => m.label).filter(Boolean).join('\n')}
                  style={{
                    position: 'relative',
                    minHeight: 44, padding: '4px 4px 10px',
                    borderRadius: 6,
                    background: todayCell ? 'var(--accent)' : 'transparent',
                    opacity: c.outside ? 0.35 : 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                  }}
                >
                  <div style={{
                    fontSize: 13, fontFamily: 'var(--mono)',
                    fontWeight: todayCell ? 700 : 500,
                    color: todayCell ? '#fff'
                      : weekday === weekendIdx.sun ? 'var(--red)'
                      : weekday === weekendIdx.sat ? 'var(--blue)'
                      : 'var(--text)',
                  }}>{c.d}</div>
                  <div style={{
                    fontSize: 9,
                    color: todayCell ? 'rgba(255,255,255,.85)' : 'var(--text3)',
                  }}>{lunarDay(c.y, c.m + 1, c.d)}</div>
                  {cellMarkers.length > 0 && (
                    <div style={{
                      position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
                      display: 'flex', gap: 2,
                    }}>
                      {cellMarkers.slice(0, 3).map((mk, idx) => (
                        <div key={idx} style={{
                          width: 4, height: 4, borderRadius: 4, background: mk.color,
                        }} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: 360 }}>
          {sortedMarkers.length === 0 ? (
            <div style={{ padding: '24px 4px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
              尚無待辦事項
            </div>
          ) : sortedMarkers.map((m, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 4px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: 6, background: m.color, flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--text3)', width: 44, flexShrink: 0 }}>{fmtTw(m.date)}</span>
              <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button onClick={backToday} className="btn btn-sm" style={{ flex: 1 }}>返回今日</button>
        <button onClick={() => setMode(v => v === 'calendar' ? 'todo' : 'calendar')} className="btn btn-sm" style={{ flex: 1 }}>
          {mode === 'calendar' ? '切換為待辦清單' : '切換為月曆顯示'}
        </button>
      </div>
    </div>
  )
}
