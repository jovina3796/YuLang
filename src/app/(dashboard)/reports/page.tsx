import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'
import { ArrowBigRightDash } from 'lucide-react'
import { billingPeriodLabel } from '../vendor-info/_helpers'

type Vendor = { id: string; name: string; warehouse: string | null; billing_cycle_start_day: number; payment_delay_months: number }
type Trip   = { final_fare: number | null; vendor_id: string; rate_rule_id: string | null; departed_at: string | null; trip_count: number | null; driver_id: string | null }
type Driver = { id: string; name: string; default_vehicle_id: string | null }

// Taipei (UTC+8) 午夜邊界：避免伺服器在 UTC 時，new Date(y,m,d) 產出 UTC 午夜
// 而與資料庫中以 +08:00 寫入的 departed_at 比對失準（跨日問題）。
function tpeMidnight(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d) - 8 * 3600 * 1000)
}

function periodFor(v: Pick<Vendor, 'billing_cycle_start_day'>, closeY: number, closeM: number) {
  const sd = v.billing_cycle_start_day ?? 1
  if (sd === 1) return { start: tpeMidnight(closeY, closeM, 1), end: tpeMidnight(closeY, closeM + 1, 1) }
  return { start: tpeMidnight(closeY, closeM - 1, sd), end: tpeMidnight(closeY, closeM, sd) }
}

function naturalMonth(y: number, m: number) {
  return { start: tpeMidnight(y, m, 1), end: tpeMidnight(y, m + 1, 1) }
}

function shiftMonth(y: number, m: number, deltaMonths: number) {
  const total = y * 12 + m + deltaMonths
  const ny = Math.floor(total / 12)
  const nm = ((total % 12) + 12) % 12
  return { y: ny, m: nm }
}

function sumTripsInRange(trips: Trip[], vendorMap: Record<string, Vendor>, closeY: number, closeM: number, mode: 'natural' | 'billing') {
  const nm = naturalMonth(closeY, closeM)
  return trips.reduce((s, t) => {
    if (!t.departed_at) return s
    const at = new Date(t.departed_at)
    let inRange: boolean
    if (mode === 'natural') {
      inRange = at >= nm.start && at < nm.end
    } else {
      const v = vendorMap[t.vendor_id]
      if (!v) return s
      const p = periodFor(v, closeY, closeM)
      inRange = at >= p.start && at < p.end
    }
    return inRange ? s + (t.final_fare ?? 0) : s
  }, 0)
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string; ym?: string; driverId?: string }>
}) {
  const supabase = createServiceClient()
  const { cycle, ym, driverId } = await searchParams
  const mode: 'natural' | 'billing' = cycle === 'natural' ? 'natural' : 'billing'

  const now = new Date()
  const ymMatch = ym && /^\d{4}-\d{2}$/.test(ym) ? ym.split('-').map(Number) : null
  const year  = ymMatch ? ymMatch[0] : now.getFullYear()
  const month = ymMatch ? ymMatch[1] - 1 : now.getMonth()
  const ymStr = `${year}-${String(month + 1).padStart(2, '0')}`

  const windowStart = tpeMidnight(year, month - 9, 1).toISOString()
  const monthStart  = tpeMidnight(year, month, 1).toISOString()
  const monthEnd    = tpeMidnight(year, month + 1, 1).toISOString()
  const monthStartD = monthStart.split('T')[0]
  const monthEndD   = monthEnd.split('T')[0]
  void monthStartD; void monthEndD

  // 動態建立帶有司機篩選條件的查詢 (針對車趟與加油)
  let tripsQuery = supabase.from('trips')
    .select('final_fare, vendor_id, rate_rule_id, departed_at, trip_count, driver_id')
    .gte('departed_at', windowStart)
    .eq('status', 'completed')
  if (driverId && driverId !== 'all') {
    tripsQuery = tripsQuery.eq('driver_id', driverId)
  }

  let fuelLogsQuery = supabase.from('fuel_logs')
    .select('total_cost, liters, logged_at')
    .gte('logged_at', tpeMidnight(year, month - 5, 1).toISOString())
    .lt('logged_at', tpeMidnight(year, month + 1, 1).toISOString())
  if (driverId && driverId !== 'all') {
    fuelLogsQuery = fuelLogsQuery.eq('driver_id', driverId)
  }

  // 執行所有查詢
  const [
    { data: allTrips },
    { data: fuelLogs },
    { data: maintLogs },
    { data: miscTxs },
    { data: vendors },
    { data: rateRules },
    { data: fixedExp },
    { data: allDrivers },
    { data: allVehicles },
  ] = await Promise.all([
    tripsQuery,
    fuelLogsQuery,
    supabase.from('maintenance_logs').select('cost, serviced_at, deduct_month, vehicle_id')
      .gte('serviced_at', tpeMidnight(year, month - 6, 1).toISOString().split('T')[0])
      .lt('serviced_at', tpeMidnight(year, month + 3, 1).toISOString().split('T')[0]),
    supabase.from('misc_transactions').select('type, amount, category, transaction_date, deduct_month, payment_status')
      .gte('transaction_date', tpeMidnight(year, month - 6, 1).toISOString().split('T')[0])
      .lt('transaction_date', tpeMidnight(year, month + 3, 1).toISOString().split('T')[0])
      .eq('payment_status', 'paid'),
    supabase.from('vendors')
      .select('id, name, warehouse, billing_cycle_start_day, payment_delay_months, display_order')
      .order('display_order', { ascending: true, nullsFirst: false }).order('name'),
    supabase.from('vendor_rate_rules')
      .select('id, vendor_id, service_type, destination_area, upstream_commission'),
    supabase.from('fixed_expenses')
      .select('name, category, amount, active, start_month, end_month, vehicle_id')
      .eq('active', true),
    supabase.from('drivers')
      .select('id, name, default_vehicle_id')
      .eq('status', 'active')
      .order('display_order', { ascending: true, nullsFirst: false }),
    supabase.from('vehicles')
      .select('id, assigned_driver_id')
  ])

  // ===== 建立關聯車輛過濾邏輯 =====
  const allowedVehicleIds = new Set<string>()
  if (driverId && driverId !== 'all') {
    // 1. 從司機預設車輛找
    const driverInfo = (allDrivers ?? []).find(d => d.id === driverId)
    if (driverInfo?.default_vehicle_id) allowedVehicleIds.add(driverInfo.default_vehicle_id)
    
    // 2. 從車輛指派紀錄找
    ;(allVehicles ?? []).forEach(v => {
      if (v.assigned_driver_id === driverId) allowedVehicleIds.add(v.id)
    })
  }

  let validMaintLogs = (maintLogs ?? []) as any[]
  let validFixedExp = (fixedExp ?? []) as any[]
  let validMiscTxs = (miscTxs ?? []) as any[]

  if (driverId && driverId !== 'all') {
    // 扣除項目只列出該司機駕駛車輛的費用
    validMaintLogs = validMaintLogs.filter(m => m.vehicle_id && allowedVehicleIds.has(m.vehicle_id))
    validFixedExp = validFixedExp.filter(f => f.vehicle_id && allowedVehicleIds.has(f.vehicle_id))
    // 雜項通常視為公司公費，若篩選個人帳則歸零
    validMiscTxs = [] 
  }
  // ==================================

  const trips: Trip[] = (allTrips ?? []) as Trip[]
  const drivers: Driver[] = (allDrivers ?? []) as Driver[]
  
  const vendorMap: Record<string, Vendor> = {}
  ;(vendors ?? []).forEach(v => {
    vendorMap[v.id] = {
      id: v.id, name: v.name, warehouse: v.warehouse,
      billing_cycle_start_day: v.billing_cycle_start_day ?? 1,
      payment_delay_months:    v.payment_delay_months    ?? 2,
    }
  })

  const fuelCost = (fuelLogs ?? []).filter((f: any) => {
    const at = new Date(f.logged_at)
    return at >= tpeMidnight(year, month, 1) && at < tpeMidnight(year, month + 1, 1)
  }).reduce((s: number, f: any) => s + Number(f.total_cost ?? 0), 0)

  // KPI 維修保養：依施作月份 (serviced_at) 加總當月金額
  const maintCostByService = validMaintLogs.filter((m: any) =>
    String(m.serviced_at).slice(0, 7) === ymStr
  ).reduce((s: number, m: any) => s + Number(m.cost ?? 0), 0)

  // 扣項統計用：依 deduct_month 設定（無則 fallback 至施作月）
  const maintCost = validMaintLogs.filter((m: any) => {
    const effective = m.deduct_month ? String(m.deduct_month).slice(0, 7) : String(m.serviced_at).slice(0, 7)
    return effective === ymStr
  }).reduce((s: number, m: any) => s + Number(m.cost ?? 0), 0)

  // Misc: use deduct_month if set, else transaction_date
  const ymStrShort = ymStr // YYYY-MM
  const miscEffectiveThisMonth = validMiscTxs.filter((t: any) => {
    const effective = t.deduct_month ? String(t.deduct_month).slice(0, 7) : String(t.transaction_date).slice(0, 7)
    return effective === ymStrShort
  })
  const miscIncome  = miscEffectiveThisMonth.filter((t: any) => t.type === 'income') .reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0)
  const miscExpense = miscEffectiveThisMonth.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0)

  // Fixed expenses active in target month
  const targetMonthDate = tpeMidnight(year, month, 15)
  const activeFixed = validFixedExp.filter((f: any) => {
    const start = f.start_month ? new Date(f.start_month) : null
    const end   = f.end_month   ? new Date(f.end_month)   : null
    if (start && targetMonthDate < start) return false
    if (end   && targetMonthDate > end)   return false
    return true
  })
  const fixedByCategory = new Map<string, number>()
  activeFixed.forEach((f: any) => {
    const key = f.category || f.name || '其他固定'
    fixedByCategory.set(key, (fixedByCategory.get(key) ?? 0) + Number(f.amount ?? 0))
  })

  // Rate-rule lookup
  type RuleInfo = { vendor_id: string; service_type: string; destination_area: string | null; upstream_commission: number | null }
  const ruleMap: Record<string, RuleInfo> = {}
  rateRules?.forEach(r => {
    ruleMap[r.id] = {
      vendor_id: r.vendor_id, service_type: r.service_type,
      destination_area: r.destination_area, upstream_commission: r.upstream_commission,
    }
  })

  function isInThisPeriod(t: Trip): boolean {
    if (!t.departed_at) return false
    const at = new Date(t.departed_at)
    if (mode === 'natural') return at >= tpeMidnight(year, month, 1) && at < tpeMidnight(year, month + 1, 1)
    const v = vendorMap[t.vendor_id]
    if (!v) return false
    const p = periodFor(v, year, month)
    return at >= p.start && at < p.end
  }
  const periodTrips = trips.filter(isInThisPeriod)

  // Viewing-month vendor share (for 廠商收入佔比 chart)
  const periodByVendor: Record<string, number> = {}
  periodTrips.forEach(t => {
    if (!t.vendor_id) return
    periodByVendor[t.vendor_id] = (periodByVendor[t.vendor_id] ?? 0) + (t.final_fare ?? 0)
  })

  // 當月營收小計用 — periodTrips 的總和
  let periodGrandRev = 0, periodGrandCommissionAmt = 0
  periodTrips.forEach(t => {
    if (!t.rate_rule_id) return
    const rule = ruleMap[t.rate_rule_id]
    const rev  = t.final_fare ?? 0
    periodGrandRev           += rev
    periodGrandCommissionAmt += rev * (rule?.upstream_commission ?? 0)
  })
  const periodGrandNet = periodGrandRev - periodGrandCommissionAmt

  // Incoming trips — 本月實際入帳的車趟（上個計費區間）
  const incomingTrips: Trip[] = []
  ;(vendors ?? []).forEach(v => {
    const delay = v.payment_delay_months ?? 2
    const close = shiftMonth(year, month, -delay)
    const p = periodFor({ billing_cycle_start_day: v.billing_cycle_start_day ?? 1 }, close.y, close.m)
    trips.forEach(t => {
      if (t.vendor_id !== v.id || !t.departed_at) return
      const at = new Date(t.departed_at)
      if (at >= p.start && at < p.end) incomingTrips.push(t)
    })
  })

  // 進項統計 — 對應「本月實際入帳」的車趟
  const breakdown: Record<string, Record<string, { rev: number; trips: number }>> = {}
  incomingTrips.forEach(t => {
    if (!t.vendor_id || !t.rate_rule_id) return
    if (!breakdown[t.vendor_id]) breakdown[t.vendor_id] = {}
    if (!breakdown[t.vendor_id][t.rate_rule_id]) breakdown[t.vendor_id][t.rate_rule_id] = { rev: 0, trips: 0 }
    breakdown[t.vendor_id][t.rate_rule_id].rev   += t.final_fare ?? 0
    breakdown[t.vendor_id][t.rate_rule_id].trips += t.trip_count ?? 1
  })

  type Row = {
    vendorId: string; vendorName: string; vendorBilling: string; item: string
    trips: number; revenue: number; commission: number; commissionAmount: number; netRevenue: number
    isFirstOfVendor: boolean; vendorRowSpan?: number; vendorSubtotal?: number
  }
  const rows: Row[] = []
  let grandTrips = 0, grandRev = 0, grandCommissionAmt = 0, grandNet = 0

  const vendorOrder = Object.keys(breakdown).sort((a, b) => {
    const na = vendorMap[a]?.name ?? a
    const nb = vendorMap[b]?.name ?? b
    return na.localeCompare(nb, 'zh-Hant')
  })

  vendorOrder.forEach(vid => {
    const v = vendorMap[vid]
    const vendorName = v ? `${v.name}${v.warehouse ? `／${v.warehouse}` : ''}` : vid
    const vendorBilling = v
      ? billingPeriodLabel(v.billing_cycle_start_day ?? 1, v.payment_delay_months ?? 2)
      : ''
    const ruleEntries = Object.entries(breakdown[vid])
      .map(([rid, { rev, trips }]) => {
        const rule = ruleMap[rid]
        const item = rule
          ? `${rule.service_type}${rule.destination_area ? ` (${rule.destination_area})` : ''}`
          : '未知規則'
        const commission = rule?.upstream_commission ?? 0
        const commissionAmount = rev * commission
        const net = rev - commissionAmount
        return { rid, item, trips, rev, commission, commissionAmount, net }
      })
      .sort((a, b) => b.rev - a.rev)

    const vendorSubtotal = ruleEntries.reduce((s, r) => s + r.net, 0)
    grandTrips         += ruleEntries.reduce((s, r) => s + r.trips, 0)
    grandRev           += ruleEntries.reduce((s, r) => s + r.rev, 0)
    grandCommissionAmt += ruleEntries.reduce((s, r) => s + r.commissionAmount, 0)
    grandNet           += vendorSubtotal

    ruleEntries.forEach((r, idx) => {
      rows.push({
        vendorId: vid, vendorName, vendorBilling, item: r.item,
        trips: r.trips, revenue: r.rev,
        commission: r.commission, commissionAmount: r.commissionAmount,
        netRevenue: r.net,
        isFirstOfVendor: idx === 0,
        vendorRowSpan:   idx === 0 ? ruleEntries.length : undefined,
        vendorSubtotal:  idx === 0 ? vendorSubtotal : undefined,
      })
    })
  })

  // Deduction breakdown for the right panel
  const deductionRows: { label: string; amount: number }[] = []
  for (const [cat, amt] of fixedByCategory) deductionRows.push({ label: cat, amount: amt })
  if (maintCost > 0)   deductionRows.push({ label: '維修保養', amount: maintCost })
  if (miscExpense > 0) deductionRows.push({ label: '其他項目', amount: miscExpense })
  const deductionTotal = deductionRows.reduce((s, r) => s + r.amount, 0)

  const netReceivable = grandNet - deductionTotal
  const profit = periodGrandNet - deductionTotal + miscIncome

  const prevPeriodRev = (() => {
    const prev = shiftMonth(year, month, -1)
    return trips.reduce((s, t) => {
      if (!t.departed_at) return s
      const at = new Date(t.departed_at)
      if (mode === 'natural') {
        const start = tpeMidnight(prev.y, prev.m, 1)
        const end   = tpeMidnight(prev.y, prev.m + 1, 1)
        return at >= start && at < end ? s + (t.final_fare ?? 0) : s
      }
      const v = vendorMap[t.vendor_id]
      if (!v) return s
      const p = periodFor(v, prev.y, prev.m)
      return at >= p.start && at < p.end ? s + (t.final_fare ?? 0) : s
    }, 0)
  })()
  const revDelta = prevPeriodRev > 0 ? (((periodGrandRev - prevPeriodRev) / prevPeriodRev) * 100).toFixed(1) : null

  const vendorRevList = Object.entries(periodByVendor)
    .map(([vid, rev]) => {
      const v = vendorMap[vid]
      return { name: v ? `${v.name}${v.warehouse ? `／${v.warehouse}` : ''}` : vid, rev }
    })
    .sort((a, b) => b.rev - a.rev)
    .slice(0, 6)
  const totalVendorRev = vendorRevList.reduce((s, v) => s + v.rev, 0)

  const trendData = Array.from({ length: 6 }, (_, i) => {
    const ref = shiftMonth(year, month, -(5 - i))
    const label = `${ref.y}/${String(ref.m + 1).padStart(2, '0')}`
    const rev = sumTripsInRange(trips, vendorMap, ref.y, ref.m, mode)
    return { label, rev }
  })
  const maxRev = Math.max(...trendData.map(d => d.rev), 1)

  const fuelTrendData = Array.from({ length: 6 }, (_, i) => {
    const ref = shiftMonth(year, month, -(5 - i))
    const start = tpeMidnight(ref.y, ref.m, 1)
    const end   = tpeMidnight(ref.y, ref.m + 1, 1)
    const inMonth = (fuelLogs ?? []).filter((f: any) => {
      const at = new Date(f.logged_at)
      return at >= start && at < end
    })
    const liters = inMonth.reduce((s: number, f: any) => s + Number(f.liters ?? 0), 0)
    const cost   = inMonth.reduce((s: number, f: any) => s + Number(f.total_cost ?? 0), 0)
    return { label: `${ref.y}/${String(ref.m + 1).padStart(2, '0')}`, liters, cost }
  })
  const maxFuelLiters = Math.max(...fuelTrendData.map(d => d.liters), 1)
  const maxFuelCost   = Math.max(...fuelTrendData.map(d => d.cost), 1)

  const delayCounts = new Map<number, number>()
  ;(vendors ?? []).forEach(v => delayCounts.set(v.payment_delay_months ?? 2, (delayCounts.get(v.payment_delay_months ?? 2) ?? 0) + 1))
  let primaryDelay = 2
  let maxCount = 0
  for (const [d, c] of delayCounts) if (c > maxCount) { primaryDelay = d; maxCount = c }
  const payoutDate = tpeMidnight(year, month, 6)
  const weekdayLabel = ['日', '一', '二', '三', '四', '五', '六'][payoutDate.getDay()]
  const payoutStr = `${payoutDate.getFullYear()}/${String(payoutDate.getMonth() + 1).padStart(2, '0')}/${String(payoutDate.getDate()).padStart(2, '0')} 週${weekdayLabel}`
  void primaryDelay

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <form method="GET" action="/reports" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="hidden" name="cycle" value={mode} />
          <input
            type="month" name="ym" defaultValue={ymStr}
            className="input" style={{ height: 30, padding: '4px 10px', fontSize: 12, width: 140 }}
          />

          {/* 司機下拉選單 */}
          <select
            name="driverId"
            defaultValue={driverId || 'all'}
            className="input"
            style={{ height: 30, padding: '4px 10px', fontSize: 12, minWidth: 130, borderRadius: 6, border: '1px solid var(--border)', background: '#fff' }}
          >
            <option value="all">所有司機</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <button type="submit" className="btn btn-sm">查詢</button>
          
          <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginLeft: 12 }}>
            <Link href={`/reports?cycle=natural${ym ? `&ym=${ymStr}` : ''}${driverId ? `&driverId=${driverId}` : ''}`} prefetch={false} style={{
              padding: '6px 14px', fontSize: 12, textDecoration: 'none',
              background: mode === 'natural' ? 'var(--accent2)' : 'transparent',
              color:      mode === 'natural' ? '#fff' : 'var(--text2)',
            }}>自然月</Link>
            <Link href={`/reports?cycle=billing${ym ? `&ym=${ymStr}` : ''}${driverId ? `&driverId=${driverId}` : ''}`} prefetch={false} style={{
              padding: '6px 14px', fontSize: 12, textDecoration: 'none',
              background: mode === 'billing' ? 'var(--accent2)' : 'transparent',
              color:      mode === 'billing' ? '#fff' : 'var(--text2)',
            }}>計費週期</Link>
          </div>
        </form>
      </div>

      {/* 5 KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          {
            label: `${ymStr} 應收款項`,
            value: netReceivable !== 0 ? Math.round(netReceivable).toLocaleString() : '0',
            color: 'var(--accent2)',
            sub: `已扣上游抽成 ${Math.round(grandCommissionAmt).toLocaleString()} + 扣項 ${Math.round(deductionTotal).toLocaleString()}`,
            big: true,
          },
          {
            label: `${ymStr} 油料成本`,
            value: fuelCost > 0 ? fuelCost.toLocaleString() : '0',
            color: 'var(--amber2)',
            sub: '另以信用卡/現金支付，不計入營收',
          },
          {
            label: `${ymStr} 維修保養`,
            value: maintCostByService > 0 ? maintCostByService.toLocaleString() : '0',
            color: 'var(--red)',
            sub: '本月施作金額加總',
          },
          {
            label: `${ymStr} 其他支出項目`,
            value: miscExpense > 0 ? miscExpense.toLocaleString() : '0',
            color: 'var(--purple)',
            sub: '計入本月費用',
          },
          {
            label: `${ymStr} 當月營收小計`,
            value: periodGrandRev > 0 ? Math.round(profit).toLocaleString() : '0',
            color: profit >= 0 ? 'var(--accent2)' : 'var(--red)',
            sub: revDelta !== null ? `${Number(revDelta) >= 0 ? '▲' : '▼'} ${Math.abs(Number(revDelta))}% 較上月` : '本月可支配淨額',
          },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: k.big ? 26 : 24, fontWeight: 700, fontFamily: 'var(--mono)', color: k.color }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11, marginTop: 6, color: 'var(--text3)' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Middle row: revenue trend / fuel trend / vendor share */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div className="card">
          <div className="card-head"><div className="card-title">近 6 個月營收</div></div>
          <div style={{ padding: '8px 0 4px' }}>
            {trendData.map(d => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '0 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', width: 60, flexShrink: 0 }}>{d.label}</div>
                <div className="prog-wrap" style={{ flex: 1 }}>
                  <div style={{ height: '100%', width: `${(d.rev / maxRev) * 100}%`, background: 'var(--accent)', borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent2)', width: 64, textAlign: 'right', flexShrink: 0 }}>
                  {d.rev > 0 ? d.rev.toLocaleString() : '0'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">近 6 個月油耗 / 費用</div>
            <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text3)' }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--purple)', borderRadius: 2, marginRight: 4 }} />油耗(L)</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--amber2)', borderRadius: 2, marginRight: 4 }} />費用($)</span>
            </div>
          </div>
          <div style={{ padding: '8px 0 4px' }}>
            {fuelTrendData.map(d => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '0 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', width: 56, flexShrink: 0 }}>{d.label}</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="prog-wrap" style={{ flex: 1, height: 6 }}>
                      <div style={{ height: '100%', width: `${(d.liters / maxFuelLiters) * 100}%`, background: 'var(--purple)', borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--purple)', width: 60, textAlign: 'right', flexShrink: 0 }}>
                      {d.liters > 0 ? `${d.liters.toLocaleString(undefined, { maximumFractionDigits: 0 })} L` : '0 L'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="prog-wrap" style={{ flex: 1, height: 6 }}>
                      <div style={{ height: '100%', width: `${(d.cost / maxFuelCost) * 100}%`, background: 'var(--amber2)', borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--amber2)', width: 60, textAlign: 'right', flexShrink: 0 }}>
                      {d.cost > 0 ? d.cost.toLocaleString() : '0'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">{ymStr} 廠商收入佔比</div></div>
          {vendorRevList.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>尚無資料</div>
          ) : (
            <div style={{ padding: '8px 0 4px' }}>
              {vendorRevList.map(v => {
                const pct = totalVendorRev > 0 ? ((v.rev / totalVendorRev) * 100).toFixed(1) : '0'
                return (
                  <div key={v.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '0 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', width: 100, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                    <div className="prog-wrap" style={{ flex: 1 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--blue)', borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--blue)', width: 48, textAlign: 'right', flexShrink: 0 }}>{pct}%</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: commission breakdown + deductions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">本月進項統計</div>
              <div className="card-sub">上游支付日期：{payoutStr}</div>
            </div>
            <Link href="/trips" className="btn btn-sm">詳細資料 <ArrowBigRightDash size={14} /></Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>廠商</th>
                <th>業務</th>
                <th>趟數</th>
                <th>實際運費</th>
                <th>抽成比例</th>
                <th>淨值</th>
                <th>廠商小計</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>{ymStr} 尚無進項</td></tr>
              ) : rows.map((r, i) => (
                <tr key={`${r.vendorId}-${i}`}>
                  {r.isFirstOfVendor ? (
                    <td className="name" rowSpan={r.vendorRowSpan} style={{ verticalAlign: 'top' }}>
                      <div>{r.vendorName}</div>
                      {r.vendorBilling && (
                        <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 400, marginTop: 2 }}>
                          {r.vendorBilling}
                        </div>
                      )}
                    </td>
                  ) : null}
                  <td>{r.item}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{r.trips}</td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--accent2)' }}>{r.revenue.toLocaleString()}</td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--text3)' }}>{(r.commission * 100).toFixed(0)}%</td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--blue)' }}>{Math.round(r.netRevenue).toLocaleString()}</td>
                  {r.isFirstOfVendor ? (
                    <td className="mono" rowSpan={r.vendorRowSpan}
                        style={{ verticalAlign: 'top', textAlign: 'right', color: 'var(--amber2)', fontWeight: 700 }}>
                      {Math.round(r.vendorSubtotal!).toLocaleString()}
                    </td>
                  ) : null}
                </tr>
              ))}
              {rows.length > 0 && (
                <tr style={{ borderTop: '2px solid var(--border2)' }}>
                  <td colSpan={2} style={{ fontWeight: 700, color: 'var(--text2)' }}>總計</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{grandTrips}</td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--accent2)', fontWeight: 700 }}>{grandRev.toLocaleString()}</td>
                  <td></td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--blue)', fontWeight: 700 }}>{Math.round(grandNet).toLocaleString()}</td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--amber2)', fontWeight: 700, fontSize: 15 }}>
                    {Math.round(grandNet).toLocaleString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">本月扣項統計</div>
            <Link href="/misc" className="btn btn-sm">詳細資料 <ArrowBigRightDash size={14} /></Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>項目</th>
                <th>金額</th>
              </tr>
            </thead>
            <tbody>
              {deductionRows.length === 0 ? (
                <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>尚無扣項</td></tr>
              ) : deductionRows.map(d => (
                <tr key={d.label}>
                  <td>{d.label}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{Math.round(d.amount).toLocaleString()}</td>
                </tr>
              ))}
              {deductionRows.length > 0 && (
                <tr style={{ borderTop: '2px solid var(--border2)' }}>
                  <td style={{ fontWeight: 700 }}>總計</td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--amber2)', fontWeight: 700 }}>
                    {Math.round(deductionTotal).toLocaleString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
