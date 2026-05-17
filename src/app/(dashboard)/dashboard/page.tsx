import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'
import { ArrowBigRightDash } from 'lucide-react'
import DashboardCalendar, { type Marker } from '@/components/DashboardCalendar'
import NotesPanel from '@/components/NotesPanel'
import LoginInfoPanel from '@/components/LoginInfoPanel'
import { getMonthlyKpis } from '@/lib/monthlyKpi'

const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六']

function simplifyVendor(name: string | null | undefined): string {
  if (!name) return ''
  return name
    .replace(/股份有限公司|有限公司|股份/g, '')
    .replace(/[（(].*?[)）]/g, '')
    .trim() || name
}

async function getData() {
  const supabase = createServiceClient()
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const monthStart = new Date(y, m, 1).toISOString()
  const monthEnd   = new Date(y, m + 1, 1).toISOString()

  const toLocalIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const dayMon = (now.getDay() + 6) % 7
  const weekStart = new Date(y, m, now.getDate() - dayMon)
  const weekEnd   = new Date(y, m, now.getDate() - dayMon + 6)
  const weekStartD = toLocalIso(weekStart)
  const weekEndD   = toLocalIso(weekEnd)

  const [
    vehiclesRes,
    driversRes,
    schedulesRes,
    pendingRes,
    inspectionsRes,
    maintRes,
    recentTripsRes,
    notesRes,
    pendingClaimsRes,
    pendingLeavesRes,
    pendingOvertimesRes,
  ] = await Promise.all([
    supabase.from('vehicles')
      .select('id, plate_number, status, mileage, updated_at')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('plate_number'),
    supabase.from('drivers')
      .select('id, name, status')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('name'),
    supabase.from('schedules')
      .select('scheduled_date, shift, drivers(name)')
      .gte('scheduled_date', weekStartD).lte('scheduled_date', weekEndD)
      .order('scheduled_date').order('shift'),
    supabase.from('misc_transactions')
      .select('id, transaction_date, due_date, category, amount, payment_method, payment_status, notes')
      .eq('type', 'expense')
      .eq('payment_status', 'pending')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('transaction_date', { ascending: false })
      .limit(8),
    supabase.from('inspection_logs')
      .select('vehicle_id, inspected_at, next_due_date')
      .order('inspected_at', { ascending: false }),
    supabase.from('maintenance_logs')
      .select('id, serviced_at, vendor_name, type, vehicles(plate_number)')
      .order('serviced_at', { ascending: false })
      .limit(10),
    supabase.from('trips')
      .select('id, departed_at, trip_count, vendors(name, warehouse), vendor_rate_rules!rate_rule_id(service_type)')
      .gte('departed_at', monthStart).lt('departed_at', monthEnd)
      .order('departed_at', { ascending: false, nullsFirst: false })
      .limit(10),
    supabase.from('notes').select('id, content').order('display_order').order('created_at'),
    supabase.from('driver_claims')
      .select('driver_id, claim_type, status')
      .eq('status', 'pending'),
    supabase.from('driver_leaves')
      .select('driver_id, status')
      .eq('status', 'pending'),
    supabase.from('driver_overtimes')
      .select('driver_id, status')
      .eq('status', 'pending'),
  ])

  return {
    vehicles: vehiclesRes.data ?? [],
    drivers:  driversRes.data ?? [],
    schedules: schedulesRes.data ?? [],
    pending:   pendingRes.data ?? [],
    inspections: inspectionsRes.data ?? [],
    maintenance: maintRes.data ?? [],
    recentTrips: recentTripsRes.data ?? [],
    notes: notesRes.data ?? [],
    pendingClaims:    pendingClaimsRes.data ?? [],
    pendingLeaves:    pendingLeavesRes.data ?? [],
    pendingOvertimes: pendingOvertimesRes.data ?? [],
    weekStart, now,
  }
}

const vehicleStatusBadge: Record<string, { label: string; cls: string }> = {
  active:      { label: '正常', cls: 'badge-green' },
  maintenance: { label: '維修', cls: 'badge-red'   },
  retired:     { label: '退役', cls: 'badge-blue'  },
}

// Placeholder approval categories — currently not backed by tables.
// Counts default to 0 until 請假/請款/加班 tables are added.
const approvalCategories: { key: string; label: string }[] = [
  { key: 'leave',    label: '請假' },
  { key: 'claim',    label: '請款' },
  { key: 'overtime', label: '加班' },
]

export default async function DashboardPage() {
  const [
    kpi,
    {
      vehicles, drivers, schedules, pending,
      inspections, maintenance, recentTrips, notes,
      pendingClaims, pendingLeaves, pendingOvertimes,
      weekStart,
    },
  ] = await Promise.all([getMonthlyKpis(), getData()])

  const lastInspect: Record<string, string> = {}
  for (const r of inspections as any[]) {
    if (!lastInspect[r.vehicle_id]) lastInspect[r.vehicle_id] = r.inspected_at
  }

  // Calendar markers — exclude schedules (point 7)
  const markers: Marker[] = []
  pending.forEach((p: any) => markers.push({
    date: p.due_date ?? p.transaction_date, color: 'var(--amber2)',
    label: `待支付：${p.category ?? '其他'} ${Number(p.amount ?? 0).toLocaleString()}`,
  }))
  ;(inspections as any[]).slice(0, 12).forEach(i => {
    if (i.next_due_date) markers.push({
      date: i.next_due_date, color: 'var(--red)', label: '驗車到期',
    })
  })

  // Weekly schedule grid
  const weekDays: { iso: string; label: string; weekday: string }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart); d.setDate(d.getDate() + i)
    weekDays.push({
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      label: `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`,
      weekday: weekdayLabels[d.getDay()],
    })
  }
  const driverShiftMap: Record<string, Record<string, string>> = {}
  for (const s of schedules as any[]) {
    const name = s.drivers?.name ?? ''
    if (!driverShiftMap[name]) driverShiftMap[name] = {}
    driverShiftMap[name][s.scheduled_date] = s.shift ?? '出勤'
  }
  // Ensure all active drivers appear in the schedule grid
  const allDriverNames = (drivers as any[]).map(d => d.name)
  const scheduleDrivers = Array.from(new Set([...allDriverNames, ...Object.keys(driverShiftMap)])).slice(0, 8)

  const layoutStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 320px',
    gridTemplateAreas: `
      "kpiRev  kpiFuel  kpiSub   cal"
      "trips   maint    vehicle  cal"
      "trips   maint    people   cal"
      "sched   sched    pending  memo"
      "sched   sched    pending  login"
    `,
    gap: 14,
    alignItems: 'stretch',
  }

  return (
    <div style={layoutStyle}>
      <KpiCard area="kpiRev"  label="當月應收款項" value={kpi.receivable} color="var(--accent2)" />
      <KpiCard area="kpiFuel" label="當月油耗費用" value={kpi.fuelCost}   color="var(--amber2)" />
      <KpiCard area="kpiSub"  label="當月營收小計" value={kpi.subtotal}   color={kpi.subtotal >= 0 ? 'var(--blue)' : 'var(--red)'} />

      <div style={{ gridArea: 'cal' }}>
        <DashboardCalendar markers={markers} />
      </div>

      {/* 車趟概覽 */}
      <div className="card" style={{ gridArea: 'trips' }}>
        <div className="card-head">
          <div>
            <div className="card-title">車趟概覽</div>
            <div className="card-sub">本月最新 10 筆</div>
          </div>
          <Link href="/trips" className="btn btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>更多 <ArrowBigRightDash size={14} /></Link>
        </div>
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '20%' }} />
          </colgroup>
          <thead><tr>
            <th style={{ textAlign: 'left' }}>日期</th>
            <th style={{ textAlign: 'left' }}>廠商</th>
            <th style={{ textAlign: 'left' }}>業務</th>
            <th style={{ textAlign: 'center' }}>趟數</th>
          </tr></thead>
          <tbody>
            {recentTrips.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: 18 }}>尚無資料</td></tr>
            ) : recentTrips.map((t: any) => (
              <tr key={t.id}>
                <td className="mono" style={{ textAlign: 'left' }}>{t.departed_at ? t.departed_at.slice(5, 10).replace('-', '/') : ''}</td>
                <td className="name" style={{ ...ellipsisCell, textAlign: 'left' }}>
                  {t.vendors ? `${t.vendors.name}${t.vendors.warehouse ? `／${t.vendors.warehouse}` : ''}` : ''}
                </td>
                <td style={{ ...ellipsisCell, textAlign: 'left' }}>{t.vendor_rate_rules?.service_type ?? ''}</td>
                <td className="mono" style={{ textAlign: 'center' }}>{t.trip_count ?? 1}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 維修紀錄 */}
      <div className="card" style={{ gridArea: 'maint' }}>
        <div className="card-head">
          <div>
            <div className="card-title">維修紀錄</div>
            <div className="card-sub">最新 10 筆</div>
          </div>
          <Link href="/maintenance" className="btn btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>更多 <ArrowBigRightDash size={14} /></Link>
        </div>
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '30%' }} />
            <col />
          </colgroup>
          <thead><tr>
            <th style={{ textAlign: 'left' }}>日期</th>
            <th style={{ textAlign: 'left' }}>廠商</th>
            <th style={{ textAlign: 'left' }}>施作項目</th>
          </tr></thead>
          <tbody>
            {maintenance.length === 0 ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text3)', padding: 18 }}>尚無資料</td></tr>
            ) : (maintenance as any[]).map(m => (
              <tr key={m.id}>
                <td className="mono" style={{ textAlign: 'left' }}>{m.serviced_at?.slice(5).replace('-', '/') ?? ''}</td>
                <td style={{ ...ellipsisCell, textAlign: 'left' }} title={m.vendor_name ?? ''}>{simplifyVendor(m.vendor_name)}</td>
                <td style={{ ...ellipsisCell, color: 'var(--text2)', textAlign: 'left' }} title={m.type ?? ''}>{m.type ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 車輛概況 */}
      <div className="card" style={{ gridArea: 'vehicle' }}>
        <div className="card-head">
          <div className="card-title">車輛概況</div>
          <Link href="/vehicles" className="btn btn-sm">更多</Link>
        </div>
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '30%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '20%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>車號</th>
              <th style={{ textAlign: 'right' }}>里程數</th>
              <th style={{ textAlign: 'center' }}>狀態</th>
              <th style={{ textAlign: 'center' }}>更新日期</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: 18 }}>尚無資料</td></tr>
            ) : vehicles.slice(0, 5).map((v: any) => {
              const st = vehicleStatusBadge[v.status] ?? { label: v.status, cls: 'badge-blue' }
              const updated = v.updated_at ?? lastInspect[v.id]
              return (
                <tr key={v.id}>
                  <td className="mono" style={{ ...ellipsisCell, fontSize: 12, textAlign: 'center' }}>{v.plate_number}</td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 12 }}>
                    {(v.mileage ?? 0).toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
                    {updated ? String(updated).slice(5, 10).replace('-', '/') : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 人員管理 */}
      <div className="card" style={{ gridArea: 'people' }}>
        <div className="card-head">
          <div className="card-title">人員管理</div>
          <Link href="/drivers" className="btn btn-sm">更多</Link>
        </div>
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: 80 }} />
            <col />
          </colgroup>
          <thead>
            <tr><th style={{ textAlign: 'center' }}>姓名</th><th style={{ textAlign: 'left' }}>待簽核項目</th></tr>
          </thead>
          <tbody>
            {drivers.length === 0 ? (
              <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text3)', padding: 18 }}>尚無資料</td></tr>
            ) : drivers.slice(0, 6).map((d: any) => {
              const claimCount = (pendingClaims as any[]).filter(c => c.driver_id === d.id).length
              const leaveCount = (pendingLeaves as any[]).filter(l => l.driver_id === d.id).length
              const otCount    = (pendingOvertimes as any[]).filter(o => o.driver_id === d.id).length
              const counts: Record<string, number> = { leave: leaveCount, claim: claimCount, overtime: otCount }
              const hasAny = Object.values(counts).some(v => v > 0)
              return (
                <tr key={d.id}>
                  <td className="name" style={{ ...ellipsisCell, fontSize: 12, textAlign: 'center' }}>{d.name}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {approvalCategories.map(cat => {
                        const n = counts[cat.key] ?? 0
                        const active = n > 0
                        return (
                          <span key={cat.key} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 12,
                            color: active ? 'var(--amber2)' : 'var(--text3)',
                            fontWeight: active ? 600 : 400,
                          }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: 6,
                              background: active ? 'var(--amber2)' : 'var(--border2)',
                            }} />
                            {cat.label}{active ? ` ${n}` : ''}
                          </span>
                        )
                      })}
                      {!hasAny && (
                        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>無</span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 本週排班表 */}
      <div className="card" style={{ gridArea: 'sched' }}>
        <div className="card-head">
          <div>
            <div className="card-title">本週排班表</div>
            <div className="card-sub">綠 ● 出勤　／　紅 休 排休</div>
          </div>
          <Link href="/schedule" className="btn btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>更多 <ArrowBigRightDash size={14} /></Link>
        </div>
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: 120 }} />
            {weekDays.map(d => <col key={d.iso} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>人員 / 日期</th>
              {weekDays.map(d => (
                <th key={d.iso} className="mono" style={{ textAlign: 'center', fontSize: 11 }}>
                  {d.label}<br /><span style={{ color: 'var(--text3)', fontWeight: 400 }}>週{d.weekday}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scheduleDrivers.length === 0 ? (
              <tr><td colSpan={weekDays.length + 1} style={{ textAlign: 'center', color: 'var(--text3)', padding: 18 }}>尚無人員</td></tr>
            ) : scheduleDrivers.map(name => (
              <tr key={name}>
                <td className="name" style={{ ...ellipsisCell, fontSize: 12, textAlign: 'center' }}>{name}</td>
                {weekDays.map(d => {
                  const sh = driverShiftMap[name]?.[d.iso]
                  if (!sh) {
                    return <td key={d.iso} className="mono" style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>—</td>
                  }
                  const isRest = /休/.test(sh)
                  return (
                    <td key={d.iso} style={{ textAlign: 'center', fontSize: 13 }}>
                      {isRest ? (
                        <span style={{ color: 'var(--red)', fontWeight: 600 }}>休</span>
                      ) : (
                        <span style={{ color: 'var(--accent2)', fontSize: 16 }}>●</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 待支付款項 */}
      <div className="card" style={{ gridArea: 'pending' }}>
        <div className="card-head">
          <div>
            <div className="card-title">待支付款項</div>
            <div className="card-sub">現金 / 轉帳</div>
          </div>
          <Link href="/misc" className="btn btn-sm">更多</Link>
        </div>
        <div>
          {pending.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text3)' }}>無待支付項目</div>
          ) : pending.slice(0, 6).map((p: any) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '8px 14px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text)' }}>{p.category ?? '其他'}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.payment_method ?? ''}　應付 {(p.due_date ?? p.transaction_date)?.slice(5).replace('-', '/')}
                </div>
              </div>
              <span className="mono" style={{ fontSize: 12, color: 'var(--amber2)' }}>
                {Number(p.amount ?? 0).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ gridArea: 'memo' }}>
        <NotesPanel notes={notes} />
      </div>

      <div style={{ gridArea: 'login' }}>
        <LoginInfoPanel />
      </div>
    </div>
  )
}

const ellipsisCell: React.CSSProperties = {
  fontSize: 12,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

function KpiCard({ area, label, value, color }: { area: string; label: string; value: number; color: string }) {
  return (
    <div className="card" style={{ gridArea: area, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--mono)', color, lineHeight: 1 }}>
        {value !== 0 ? Math.round(value).toLocaleString() : ''}
      </div>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${color}, transparent)`,
      }} />
    </div>
  )
}
