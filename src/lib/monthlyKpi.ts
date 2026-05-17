import { createServiceClient } from '@/lib/supabase/service'

type Vendor = {
  id: string; name: string; warehouse: string | null
  billing_cycle_start_day: number; payment_delay_months: number
}
type Trip = {
  final_fare: number | null; vendor_id: string
  rate_rule_id: string | null; departed_at: string | null; trip_count: number | null
}

function periodFor(v: Pick<Vendor, 'billing_cycle_start_day'>, closeY: number, closeM: number) {
  const sd = v.billing_cycle_start_day ?? 1
  if (sd === 1) return { start: new Date(closeY, closeM, 1), end: new Date(closeY, closeM + 1, 1) }
  return { start: new Date(closeY, closeM - 1, sd), end: new Date(closeY, closeM, sd) }
}

function shiftMonth(y: number, m: number, deltaMonths: number) {
  const total = y * 12 + m + deltaMonths
  return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 }
}

/**
 * Mirror of reports/page.tsx KPI math:
 *   receivable = grandNet (incoming-trip net) - deductionTotal
 *   fuelCost   = monthly fuel total
 *   subtotal   = periodGrandNet - deductionTotal + miscIncome
 *
 * Always uses natural-month + viewing month = current month.
 */
export async function getMonthlyKpis(): Promise<{
  receivable: number
  fuelCost: number
  subtotal: number
}> {
  const supabase = createServiceClient()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const ymStr = `${year}-${String(month + 1).padStart(2, '0')}`

  const windowStart = new Date(year, month - 9, 1).toISOString()
  const monthStart  = new Date(year, month, 1).toISOString()
  const monthEnd    = new Date(year, month + 1, 1).toISOString()

  const [
    { data: allTrips },
    { data: fuelLogs },
    { data: maintLogs },
    { data: miscTxs },
    { data: vendors },
    { data: rateRules },
    { data: fixedExp },
  ] = await Promise.all([
    supabase.from('trips')
      .select('final_fare, vendor_id, rate_rule_id, departed_at, trip_count')
      .gte('departed_at', windowStart)
      .eq('status', 'completed'),
    supabase.from('fuel_logs').select('total_cost')
      .gte('logged_at', monthStart).lt('logged_at', monthEnd),
    supabase.from('maintenance_logs').select('cost, serviced_at, deduct_month')
      .gte('serviced_at', new Date(year, month - 6, 1).toISOString().slice(0, 10))
      .lt('serviced_at',  new Date(year, month + 3, 1).toISOString().slice(0, 10)),
    supabase.from('misc_transactions').select('type, amount, transaction_date, deduct_month, payment_status')
      .gte('transaction_date', new Date(year, month - 6, 1).toISOString().slice(0, 10))
      .lt('transaction_date',  new Date(year, month + 3, 1).toISOString().slice(0, 10))
      .eq('payment_status', 'paid'),
    supabase.from('vendors').select('id, name, warehouse, billing_cycle_start_day, payment_delay_months'),
    supabase.from('vendor_rate_rules').select('id, vendor_id, upstream_commission'),
    supabase.from('fixed_expenses').select('amount, active, start_month, end_month').eq('active', true),
  ])

  const trips = (allTrips ?? []) as Trip[]
  const vendorMap: Record<string, Vendor> = {}
  ;(vendors ?? []).forEach((v: any) => {
    vendorMap[v.id] = {
      id: v.id, name: v.name, warehouse: v.warehouse,
      billing_cycle_start_day: v.billing_cycle_start_day ?? 1,
      payment_delay_months:    v.payment_delay_months    ?? 2,
    }
  })

  const ruleMap: Record<string, { upstream_commission: number | null }> = {}
  ;(rateRules ?? []).forEach((r: any) => {
    ruleMap[r.id] = { upstream_commission: r.upstream_commission }
  })

  const fuelCost = (fuelLogs ?? []).reduce((s: number, f: any) => s + Number(f.total_cost ?? 0), 0)

  const maintCost = (maintLogs ?? []).filter((m: any) => {
    const eff = m.deduct_month ? String(m.deduct_month).slice(0, 7) : String(m.serviced_at).slice(0, 7)
    return eff === ymStr
  }).reduce((s: number, m: any) => s + Number(m.cost ?? 0), 0)

  const miscEffective = (miscTxs ?? []).filter((t: any) => {
    const eff = t.deduct_month ? String(t.deduct_month).slice(0, 7) : String(t.transaction_date).slice(0, 7)
    return eff === ymStr
  })
  const miscIncome  = miscEffective.filter((t: any) => t.type === 'income') .reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0)
  const miscExpense = miscEffective.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0)

  const targetMonthDate = new Date(year, month, 15)
  const fixedTotal = (fixedExp ?? []).filter((f: any) => {
    const start = f.start_month ? new Date(f.start_month) : null
    const end   = f.end_month   ? new Date(f.end_month)   : null
    if (start && targetMonthDate < start) return false
    if (end   && targetMonthDate > end)   return false
    return true
  }).reduce((s: number, f: any) => s + Number(f.amount ?? 0), 0)

  const deductionTotal = fixedTotal + maintCost + miscExpense

  // Period trips → 當月營收小計 (billing-cycle)
  const periodTrips = trips.filter(t => {
    if (!t.departed_at) return false
    const v = vendorMap[t.vendor_id]
    if (!v) return false
    const p = periodFor(v, year, month)
    const at = new Date(t.departed_at)
    return at >= p.start && at < p.end
  })
  const periodGrandNet = periodTrips.reduce((s, t) => {
    const rev = t.final_fare ?? 0
    const commission = (t.rate_rule_id ? ruleMap[t.rate_rule_id]?.upstream_commission ?? 0 : 0)
    return s + rev * (1 - commission)
  }, 0)

  // Incoming trips (prev billing period landing this month) → 應收款項
  const incomingTrips: Trip[] = []
  ;(vendors ?? []).forEach((v: any) => {
    const delay = v.payment_delay_months ?? 2
    const close = shiftMonth(year, month, -delay)
    const p = periodFor({ billing_cycle_start_day: v.billing_cycle_start_day ?? 1 }, close.y, close.m)
    trips.forEach(t => {
      if (t.vendor_id !== v.id || !t.departed_at) return
      const at = new Date(t.departed_at)
      if (at >= p.start && at < p.end) incomingTrips.push(t)
    })
  })
  const grandNet = incomingTrips.reduce((s, t) => {
    const rev = t.final_fare ?? 0
    const commission = (t.rate_rule_id ? ruleMap[t.rate_rule_id]?.upstream_commission ?? 0 : 0)
    return s + rev * (1 - commission)
  }, 0)

  return {
    receivable: grandNet - deductionTotal,
    fuelCost,
    subtotal:   periodGrandNet - deductionTotal + miscIncome,
  }
}
