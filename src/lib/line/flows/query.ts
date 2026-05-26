import { createServiceClient } from '@/lib/supabase/service'
import { reply, flexMessage, textMessage } from '@/lib/line/api'
import { tripsMonthlyQueryBubble, type ServiceSummaryLine } from '@/lib/line/flex'
import { isAdminLineUser, findDriverByName } from '@/lib/line/flows/bind'

// Trigger: a message that starts with 「查詢」/「本月車趟」/「/查詢」 (optionally followed
// by a range qualifier and / or 「指定司機：XXX」 admin override).
const TRIGGER_RE = /^(\/?查詢|本月車趟)(\s|$)/

const ASSIGN_DRIVER_HEAD_RE = /^指定司機[：:]\s*(\S+)\s+/
const ASSIGN_DRIVER_TAIL_RE = /\s+指定司機[：:]\s*(\S+)\s*$/

export function looksLikeQueryText(text: string): boolean {
  const stripped = text
    .trim()
    .replace(ASSIGN_DRIVER_HEAD_RE, '')
    .replace(ASSIGN_DRIVER_TAIL_RE, '')
    .trim()
  return TRIGGER_RE.test(stripped)
}

type Range =
  | { kind: 'month'; year: number; month: number; label: string }
  | { kind: 'days';  days: number; label: string }

function nowTW(): { y: number; m: number; d: number } {
  const tw = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return { y: tw.getUTCFullYear(), m: tw.getUTCMonth() + 1, d: tw.getUTCDate() }
}

// Returns [startUtcIso, endUtcIso) — half-open interval.
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
  // last N days, ending today (TW) inclusive
  const tw = nowTW()
  const end = new Date(`${tw.y}-${String(tw.m).padStart(2, '0')}-${String(tw.d).padStart(2, '0')}T00:00:00+08:00`)
  end.setUTCDate(end.getUTCDate() + 1) // tomorrow 00:00 TW (exclusive)
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
  // 近N天 / 近 N 天 / N天
  const days = t.match(/^(?:近\s*)?(\d{1,3})\s*天$/)
  if (days) {
    const n = Math.max(1, Math.min(365, parseInt(days[1], 10)))
    return { kind: 'days', days: n, label: `近 ${n} 天` }
  }
  // YYYY-MM
  const ym = t.match(/^(\d{4})[-/](\d{1,2})$/)
  if (ym) {
    const y = parseInt(ym[1], 10)
    const m = Math.max(1, Math.min(12, parseInt(ym[2], 10)))
    return { kind: 'month', year: y, month: m, label: `${y}-${String(m).padStart(2, '0')}` }
  }
  // fallback — current month
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

type TripRow = {
  trip_count: number | null
  final_fare: number | null
  departed_at: string | null
  vendor_rate_rules: { service_type: string | null } | { service_type: string | null }[] | null
}

export async function handleQueryText(
  driverId: string,
  driverName: string,
  lineUserId: string,
  replyToken: string,
  text: string,
): Promise<void> {
  // Admin override: "指定司機：XXX"
  let actingDriverId = driverId
  let actingDriverName = driverName
  let body = text.trim()
  const assigned = extractAssignedDriver(body)
  if (assigned) {
    if (!(await isAdminLineUser(lineUserId))) {
      await reply(replyToken, [textMessage('「指定司機」僅限管理員使用。')])
      return
    }
    const target = await findDriverByName(assigned.name)
    if (!target) {
      await reply(replyToken, [textMessage(`找不到司機「${assigned.name}」（需為啟用中且姓名完全相符）。`)])
      return
    }
    actingDriverId = target.id
    actingDriverName = target.name
    body = assigned.remaining
  }

  // Strip trigger keyword to get the optional range qualifier.
  const qualifier = body.replace(TRIGGER_RE, '').trim()
  const range = parseRange(qualifier)
  const { startIso, endIso } = rangeToUtc(range)

  const supabase = createServiceClient()
  const [{ data: tripsRaw, error: tripErr }, { data: schedRaw }] = await Promise.all([
    supabase
      .from('trips')
      .select('trip_count, final_fare, departed_at, vendor_rate_rules!rate_rule_id(service_type)')
      .eq('driver_id', actingDriverId)
      .gte('departed_at', startIso)
      .lt('departed_at', endIso),
    supabase
      .from('schedules')
      .select('shift, scheduled_date')
      .eq('driver_id', actingDriverId)
      .gte('scheduled_date', startIso.slice(0, 10))
      .lt('scheduled_date', endIso.slice(0, 10)),
  ])

  if (tripErr) {
    console.error('[line.query] trips fetch failed', tripErr)
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

  const driverNote = actingDriverId !== driverId ? `代 ${actingDriverName} 查詢` : undefined

  await reply(replyToken, [
    flexMessage(
      `${actingDriverName} ${range.label} 車趟查詢`,
      tripsMonthlyQueryBubble({
        driverName: actingDriverName,
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
