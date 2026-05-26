import { createServiceClient } from '@/lib/supabase/service'
import { reply, flexMessage, textMessage } from '@/lib/line/api'
import {
  tripsMonthlyQueryBubble,
  fuelMonthlyQueryBubble,
  type ServiceSummaryLine,
  type FuelGroupLine,
} from '@/lib/line/flex'
import { isAdminLineUser, findDriverByName } from '@/lib/line/flows/bind'

// Triggers:
//   查詢車趟 / 本月車趟 / 車趟查詢   → trip query
//   查詢油資 / 本月油資 / 油資查詢   → fuel query
//   查詢                            → menu prompt
const TRIP_TRIGGER_RE = /^(?:\/?查詢車趟|本月車趟|車趟查詢|\/?車趟查詢)(\s|$)/
const FUEL_TRIGGER_RE = /^(?:\/?查詢油資|本月油資|油資查詢|\/?油資查詢)(\s|$)/
const BARE_QUERY_RE   = /^\/?查詢(\s|$)/

const ASSIGN_DRIVER_HEAD_RE = /^指定司機[：:]\s*(\S+)\s+/
const ASSIGN_DRIVER_TAIL_RE = /\s+指定司機[：:]\s*(\S+)\s*$/

export type QueryKind = 'trip' | 'fuel' | 'menu' | null

export function detectQueryKind(text: string): QueryKind {
  const stripped = text
    .trim()
    .replace(ASSIGN_DRIVER_HEAD_RE, '')
    .replace(ASSIGN_DRIVER_TAIL_RE, '')
    .trim()
  if (TRIP_TRIGGER_RE.test(stripped)) return 'trip'
  if (FUEL_TRIGGER_RE.test(stripped)) return 'fuel'
  if (BARE_QUERY_RE.test(stripped)) return 'menu'
  return null
}

type Range =
  | { kind: 'month'; year: number; month: number; label: string }
  | { kind: 'days';  days: number; label: string }

function nowTW(): { y: number; m: number; d: number } {
  const tw = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return { y: tw.getUTCFullYear(), m: tw.getUTCMonth() + 1, d: tw.getUTCDate() }
}

function rangeToUtc(r: Range): { startIso: string; endIso: string } {
  if (r.kind === 'month') {
    const ny = r.month === 12 ? r.year + 1 : r.year
    const nm = r.month === 12 ? 1 : r.month + 1
    const sm = String(r.month).padStart(2, '0')
    const nmS = String(nm).padStart(2, '0')
    return {
      startIso: new Date(`${r.year}-${sm}-01T00:00:00+08:00`).toISOString(),
      endIso:   new Date(`${ny}-${nmS}-01T00:00:00+08:00`).toISOString(),
    }
  }
  const tw = nowTW()
  const end = new Date(`${tw.y}-${String(tw.m).padStart(2, '0')}-${String(tw.d).padStart(2, '0')}T00:00:00+08:00`)
  end.setUTCDate(end.getUTCDate() + 1)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - r.days)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

function parseRange(qualifier: string): Range {
  const tw = nowTW()
  const t = qualifier.trim()
  if (!t || /^本月$/.test(t)) {
    return { kind: 'month', year: tw.y, month: tw.m, label: `${tw.y}-${String(tw.m).padStart(2, '0')}` }
  }
  if (/^上月$/.test(t)) {
    const py = tw.m === 1 ? tw.y - 1 : tw.y
    const pm = tw.m === 1 ? 12 : tw.m - 1
    return { kind: 'month', year: py, month: pm, label: `${py}-${String(pm).padStart(2, '0')}` }
  }
  const days = t.match(/^(?:近\s*)?(\d{1,3})\s*天$/)
  if (days) {
    const n = Math.max(1, Math.min(365, parseInt(days[1], 10)))
    return { kind: 'days', days: n, label: `近 ${n} 天` }
  }
  const ym = t.match(/^(\d{4})[-/](\d{1,2})$/)
  if (ym) {
    const y = parseInt(ym[1], 10)
    const m = Math.max(1, Math.min(12, parseInt(ym[2], 10)))
    return { kind: 'month', year: y, month: m, label: `${y}-${String(m).padStart(2, '0')}` }
  }
  return { kind: 'month', year: tw.y, month: tw.m, label: `${tw.y}-${String(tw.m).padStart(2, '0')}` }
}

function extractAssignedDriver(text: string): { name: string; remaining: string } | null {
  const t = text.trim()
  const head = t.match(ASSIGN_DRIVER_HEAD_RE)
  if (head) return { name: head[1], remaining: t.slice(head[0].length).trim() }
  const tail = t.match(ASSIGN_DRIVER_TAIL_RE)
  if (tail) return { name: tail[1], remaining: t.slice(0, tail.index).trim() }
  return null
}

async function resolveActingDriver(
  driverId: string,
  driverName: string,
  lineUserId: string,
  body: string,
  replyToken: string,
): Promise<{ id: string; name: string; remaining: string } | null> {
  const assigned = extractAssignedDriver(body)
  if (!assigned) return { id: driverId, name: driverName, remaining: body }
  if (!(await isAdminLineUser(lineUserId))) {
    await reply(replyToken, [textMessage('「指定司機」僅限管理員使用。')])
    return null
  }
  const target = await findDriverByName(assigned.name)
  if (!target) {
    await reply(replyToken, [textMessage(`找不到司機「${assigned.name}」（需為啟用中且姓名完全相符）。`)])
    return null
  }
  return { id: target.id, name: target.name, remaining: assigned.remaining }
}

export async function handleQueryMenu(replyToken: string): Promise<void> {
  await reply(replyToken, [
    textMessage(
      '請輸入：\n• 查詢車趟（本月車趟 / 上月 / 近7天）\n• 查詢油資（本月油資 / 上月 / 近7天）\n例：\n  查詢車趟\n  查詢油資 上月\n  查詢車趟 近7天',
    ),
  ])
}

type TripRow = {
  trip_count: number | null
  final_fare: number | null
  vendor_rate_rules: { service_type: string | null } | { service_type: string | null }[] | null
}

export async function handleTripQuery(
  driverId: string,
  driverName: string,
  lineUserId: string,
  replyToken: string,
  text: string,
): Promise<void> {
  const acting = await resolveActingDriver(driverId, driverName, lineUserId, text.trim(), replyToken)
  if (!acting) return

  const qualifier = acting.remaining.replace(TRIP_TRIGGER_RE, '').trim()
  const range = parseRange(qualifier)
  const { startIso, endIso } = rangeToUtc(range)

  const supabase = createServiceClient()
  const [{ data: tripsRaw, error: tripErr }, { data: schedRaw }] = await Promise.all([
    supabase
      .from('trips')
      .select('trip_count, final_fare, vendor_rate_rules!rate_rule_id(service_type)')
      .eq('driver_id', acting.id)
      .gte('departed_at', startIso)
      .lt('departed_at', endIso),
    supabase
      .from('schedules')
      .select('shift, scheduled_date')
      .eq('driver_id', acting.id)
      .gte('scheduled_date', startIso.slice(0, 10))
      .lt('scheduled_date', endIso.slice(0, 10)),
  ])

  if (tripErr) {
    console.error('[line.query.trip] fetch failed', tripErr)
    await reply(replyToken, [textMessage('查詢失敗，請稍後再試。')])
    return
  }

  const trips = (tripsRaw ?? []) as TripRow[]
  const byService = new Map<string, number>()
  let totalTrips = 0
  let totalFare = 0
  for (const t of trips) {
    const rRaw = t.vendor_rate_rules
    const r = Array.isArray(rRaw) ? rRaw[0] ?? null : rRaw
    const svc = r?.service_type ?? '其他'
    const count = t.trip_count ?? 1
    byService.set(svc, (byService.get(svc) ?? 0) + count)
    totalTrips += count
    totalFare += t.final_fare ?? 0
  }

  const lines: ServiceSummaryLine[] = Array.from(byService.entries())
    .map(([service, trips]) => ({ service, trips }))
    .sort((a, b) => b.trips - a.trips)

  const restDays = (schedRaw ?? []).filter(s => (s.shift ?? '').includes('休')).length
  const driverNote = acting.id !== driverId ? `代 ${acting.name} 查詢` : undefined

  await reply(replyToken, [
    flexMessage(
      `${acting.name} ${range.label} 車趟查詢`,
      tripsMonthlyQueryBubble({
        driverName: acting.name,
        rangeLabel: range.label,
        totalTrips,
        totalFare,
        restDays,
        byService: lines,
        driverNote,
      }),
    ),
  ])
}

type FuelRow = {
  total_cost: number | null
  payment_method: string | null
  vehicles: { plate_number: string | null } | { plate_number: string | null }[] | null
}

export async function handleFuelQuery(
  driverId: string,
  driverName: string,
  lineUserId: string,
  replyToken: string,
  text: string,
): Promise<void> {
  const acting = await resolveActingDriver(driverId, driverName, lineUserId, text.trim(), replyToken)
  if (!acting) return

  const qualifier = acting.remaining.replace(FUEL_TRIGGER_RE, '').trim()
  const range = parseRange(qualifier)
  const { startIso, endIso } = rangeToUtc(range)

  const supabase = createServiceClient()
  const { data: rowsRaw, error } = await supabase
    .from('fuel_logs')
    .select('total_cost, payment_method, vehicles(plate_number)')
    .eq('driver_id', acting.id)
    .gte('logged_at', startIso)
    .lt('logged_at', endIso)

  if (error) {
    console.error('[line.query.fuel] fetch failed', error)
    await reply(replyToken, [textMessage('查詢失敗，請稍後再試。')])
    return
  }

  const rows = (rowsRaw ?? []) as FuelRow[]
  const byVehicle = new Map<string, { count: number; total: number }>()
  const byPayment = new Map<string, { count: number; total: number }>()
  let totalCount = 0
  let totalAmount = 0
  for (const r of rows) {
    const cost = r.total_cost ?? 0
    const vRaw = r.vehicles
    const v = Array.isArray(vRaw) ? vRaw[0] ?? null : vRaw
    const plate = v?.plate_number ?? '未指定'
    const pay = r.payment_method ?? '未指定'
    const vEntry = byVehicle.get(plate) ?? { count: 0, total: 0 }
    vEntry.count += 1
    vEntry.total += cost
    byVehicle.set(plate, vEntry)
    const pEntry = byPayment.get(pay) ?? { count: 0, total: 0 }
    pEntry.count += 1
    pEntry.total += cost
    byPayment.set(pay, pEntry)
    totalCount += 1
    totalAmount += cost
  }

  const toLines = (m: Map<string, { count: number; total: number }>): FuelGroupLine[] =>
    Array.from(m.entries())
      .map(([label, v]) => ({ label, count: v.count, total: v.total }))
      .sort((a, b) => b.total - a.total)

  const driverNote = acting.id !== driverId ? `代 ${acting.name} 查詢` : undefined

  await reply(replyToken, [
    flexMessage(
      `${acting.name} ${range.label} 油資查詢`,
      fuelMonthlyQueryBubble({
        driverName: acting.name,
        rangeLabel: range.label,
        totalCount,
        totalAmount,
        byVehicle: toLines(byVehicle),
        byPayment: toLines(byPayment),
        driverNote,
      }),
    ),
  ])
}
