import { createServiceClient } from '@/lib/supabase/service'
import { reply, push, textMessage, flexMessage } from '@/lib/line/api'
import { tripsSuccessBubble, restDayBubble, tripsMultiDayBubble, tripParseErrorBubble, type TripLine, type TripDayGroup } from '@/lib/line/flex'
import { resolveVehicleForDriver } from '@/lib/line/vehicleResolve'
import { isAdminLineUser, findDriverByName } from '@/lib/line/flows/bind'
import { calcFare, type FareRule } from '@/lib/fare'
import {
  parseTripText,
  twDateToIso,
  twDateToYmd,
  type ParsedTrip,
  type TwDate,
} from '@/lib/line/tripTextParse'
import { calculateTripCommission } from '@/lib/finance/commission'

type RateRule = FareRule & {
  id:               string
  vendor_id:        string
  service_type:     string
  destination_area: string | null
  is_active:        boolean
  is_service_default: boolean
}

type ResolvedTrip = {
  rule:      RateRule
  area:      string | null
  stops:     number | null
  fare:      number
  vendor_label: string
}

const ADMIN_ROLES = ['admin', 'owner']

// Heuristic: any first token that looks like a date keyword belongs to
// the trip-report flow. Webhook checks this before dispatching.
const DATE_TOKEN_RE = /^(今天|今日|昨天|昨日|\d{1,2}號|\d{1,2}月\d{1,2}[號日]?|\d{1,2}\/\d{1,2})(\s|$)/

// Admin-only override prefix/suffix: 指定司機：XXX  or  指定司機:XXX
// Allowed at the start (followed by whitespace) or end (preceded by whitespace) of the message.
const ASSIGN_DRIVER_HEAD_RE = /^指定司機[：:]\s*(\S+)\s+/
const ASSIGN_DRIVER_TAIL_RE = /\s+指定司機[：:]\s*(\S+)\s*$/

export function looksLikeTripText(text: string): boolean {
  const stripped = text.trim().replace(ASSIGN_DRIVER_HEAD_RE, '').replace(ASSIGN_DRIVER_TAIL_RE, '').trim()
  return DATE_TOKEN_RE.test(stripped)
}

function extractAssignedDriver(text: string): { name: string; remaining: string } | null {
  const t = text.trim()
  const head = t.match(ASSIGN_DRIVER_HEAD_RE)
  if (head) {
    return { name: head[1], remaining: t.slice(head[0].length).trim() }
  }
  const tail = t.match(ASSIGN_DRIVER_TAIL_RE)
  if (tail) {
    return { name: tail[1], remaining: t.slice(0, tail.index).trim() }
  }
  return null
}

export async function handleTripText(
  driverId: string,
  driverName: string,
  lineUserId: string,
  replyToken: string,
  text: string,
): Promise<void> {
  const supabase = createServiceClient()

  // Admin-only: "指定司機：XXX" at start or end overrides the acting driver.
  let actingDriverId = driverId
  let actingDriverName = driverName
  let parseText = text
  const assigned = extractAssignedDriver(text)
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
    parseText = assigned.remaining
  }

  const [{ data: rulesRaw }, { data: aliasesRaw }] = await Promise.all([
    supabase
      .from('vendor_rate_rules')
      .select('id, vendor_id, service_type, destination_area, pricing_mode, base_trips, base_fare, kpi_fare, base_stops, surcharge_per_stop, special_rate, is_active, is_service_default, vendors(name, warehouse)')
      .eq('is_active', true),
    supabase.from('subroute_aliases').select('alias, billing_area'),
  ])

  const rules = ((rulesRaw ?? []) as unknown) as Array<RateRule & { vendors: { name: string; warehouse: string | null } | { name: string; warehouse: string | null }[] | null }>
  const aliasMap = new Map<string, string>()
  for (const a of (aliasesRaw ?? []) as Array<{ alias: string; billing_area: string }>) {
    aliasMap.set(a.alias, a.billing_area)
  }
  const services = Array.from(new Set(rules.map(r => r.service_type).filter(Boolean)))

  const parsed = parseTripText(parseText, services)

  if (parsed.kind === 'error') {
    await replyParseFailure(lineUserId, replyToken, text, parsed.message, actingDriverName)
    return
  }

  // Resolve all trip days first (all-or-nothing); collect rows for batch insert.
  type ResolvedDay =
    | { kind: 'rest';  date: TwDate }
    | { kind: 'trips'; date: TwDate; resolved: ResolvedTrip[] }

  const resolvedDays: ResolvedDay[] = []
  const errors: string[] = []
  for (const day of parsed.days) {
    if (day.kind === 'rest') {
      resolvedDays.push({ kind: 'rest', date: day.date })
      continue
    }
    const dayResolved: ResolvedTrip[] = []
    for (const t of day.trips) {
      const r = resolveRule(t, rules, aliasMap)
      if ('error' in r) {
        errors.push(`${twDateToYmd(day.date)}：${r.error}`)
        continue
      }
      const stops = t.stops ?? 0
      const isKpi = r.rule.pricing_mode === 'base_or_kpi' ? true : false
      const fare = calcFare(r.rule, 1, stops, isKpi, false)
      const vRaw = (r.rule as unknown as { vendors: { name: string; warehouse: string | null } | { name: string; warehouse: string | null }[] | null }).vendors
      const v = Array.isArray(vRaw) ? vRaw[0] ?? null : vRaw
      const vendorLabel = v ? `${v.name}${v.warehouse ? `／${v.warehouse}` : ''}` : ''
      dayResolved.push({ rule: r.rule, area: t.area, stops: t.stops, fare, vendor_label: vendorLabel })
    }
    resolvedDays.push({ kind: 'trips', date: day.date, resolved: dayResolved })
  }

  if (errors.length > 0) {
    await replyParseFailure(lineUserId, replyToken, text, errors.join('；'), actingDriverName)
    return
  }

  // Build trip rows (resolve vehicle per date — different days may use different vehicles).
  const tripRows: Array<Record<string, unknown>> = []
  for (const day of resolvedDays) {
    if (day.kind !== 'trips' || day.resolved.length === 0) continue
    const departedIso = twDateToIso(day.date)
    const vehicleId = await resolveVehicleForDriver(actingDriverId, new Date(departedIso))
    for (const rt of day.resolved) {
      // 🌟 新增：針對每一筆解析出的車趟，動態計算該司機對該廠商的抽成與實拿金額
      const fareInfo = await calculateTripCommission(
        actingDriverId,    // 目前回報/指定的司機 ID
        rt.rule.vendor_id, // 廠商 ID
        rt.fare            // 該趟計算出的總運費
      )

      tripRows.push({
        vendor_id:        rt.rule.vendor_id,
        rate_rule_id:     rt.rule.id,
        driver_id:        actingDriverId,
        vehicle_id:       vehicleId,
        destination_area: rt.area,
        departed_at:      departedIso,
        actual_stops:     rt.stops,
        is_kpi_achieved:  rt.rule.pricing_mode === 'base_or_kpi' ? true : null,
        is_special:       false,
        calculated_fare:  rt.fare,
        final_fare:       rt.fare,
        trip_count:       1,
        notes:            null as string | null,
        status:           'completed',
        // 👇 新增抽成資料欄位
        commission_rate:   fareInfo.commission_rate,
        driver_final_fare: fareInfo.driver_final_fare,
      })
    }
  }

  if (tripRows.length > 0) {
    const { error: insErr } = await supabase.from('trips').insert(tripRows)
    if (insErr) {
      console.error('[line.tripText] insert failed', insErr)
      await reply(replyToken, [textMessage(`寫入失敗：${insErr.message}`)])
      return
    }
  }

  // Insert rest schedules (skip those already marked rest).
  for (const day of resolvedDays) {
    if (day.kind !== 'rest') continue
    await insertRestIfMissing(actingDriverId, day.date)
  }

  // Build reply card.
  const driverNote = actingDriverId !== driverId ? `代 ${actingDriverName} 回報` : ''

  if (resolvedDays.length === 1) {
    const only = resolvedDays[0]
    if (only.kind === 'rest') {
      await reply(replyToken, [
        flexMessage('休假已登記', restDayBubble(twDateToYmd(only.date), actingDriverName + (driverNote ? `（${driverNote}）` : ''))),
      ])
      return
    }
    const lines: TripLine[] = only.resolved.map(rt => ({
      vendor:  rt.vendor_label,
      service: rt.rule.service_type,
      area:    rt.area,
      stops:   rt.stops,
      fare:    rt.fare,
    }))
    const dateLabel = twDateToYmd(only.date) + (driverNote ? `（${driverNote}）` : '')
    await reply(replyToken, [
      flexMessage('車趟已記錄', tripsSuccessBubble(dateLabel, lines)),
    ])
    return
  }

  const groups: TripDayGroup[] = resolvedDays.map(d => {
    if (d.kind === 'rest') return { kind: 'rest', date: twDateToYmd(d.date) }
    const lines: TripLine[] = d.resolved.map(rt => ({
      vendor:  rt.vendor_label,
      service: rt.rule.service_type,
      area:    rt.area,
      stops:   rt.stops,
      fare:    rt.fare,
    }))
    return { kind: 'trips', date: twDateToYmd(d.date), lines }
  })
  await reply(replyToken, [
    flexMessage('車趟已記錄', tripsMultiDayBubble(driverNote, groups)),
  ])
}

async function insertRestIfMissing(driverId: string, date: TwDate): Promise<void> {
  const supabase = createServiceClient()
  const ymd = twDateToYmd(date)
  const { data: existing } = await supabase
    .from('schedules')
    .select('id, shift')
    .eq('driver_id', driverId)
    .eq('scheduled_date', ymd)
  const restRow = (existing ?? []).find(r => (r.shift ?? '').includes('休'))
  if (restRow) return
  const { error } = await supabase.from('schedules').insert({
    driver_id:      driverId,
    vehicle_id:     null,
    scheduled_date: ymd,
    shift:          '休',
    status:         'scheduled',
  })
  if (error) {
    console.error('[line.tripText] rest insert failed', error)
    throw error
  }
}

function resolveRule(
  trip: ParsedTrip,
  rules: RateRule[],
  aliasMap: Map<string, string>,
): { rule: RateRule } | { error: string } {
  const matchedSvc = rules.filter(r => r.service_type === trip.service)
  if (matchedSvc.length === 0) {
    return { error: `業務「${trip.service}」未啟用任何費率規則` }
  }

  if (trip.area) {
    const billingArea = aliasMap.get(trip.area)
    if (!billingArea) {
      return { error: `配送區域「${trip.area}」未在對照表中` }
    }
    const exact = matchedSvc.find(r => r.destination_area === billingArea)
    if (!exact) {
      return { error: `業務「${trip.service}」找不到區域「${billingArea}」的費率規則` }
    }
    return { rule: exact }
  }

  const def = matchedSvc.find(r => r.is_service_default)
  if (def) return { rule: def }
  if (matchedSvc.length === 1) return { rule: matchedSvc[0] }
  return { error: `業務「${trip.service}」有多個費率規則，請在後台勾選「設為此業務的預設規則」` }
}

async function replyParseFailure(
  lineUserId: string,
  replyToken: string,
  originalText: string,
  reason: string,
  driverName: string,
): Promise<void> {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TRIP || process.env.NEXT_PUBLIC_LIFF_ID
  const liffUrl = liffId ? `https://liff.line.me/${liffId}` : null

  await reply(replyToken, [
    flexMessage('車趟回報解析失敗', tripParseErrorBubble(originalText, reason, liffUrl)),
  ])

  // Best-effort admin notification (don't block the user reply on this).
  notifyAdminsParseFailure(lineUserId, driverName, originalText, reason).catch(err => {
    console.error('[line.tripText] admin notify failed', err)
  })
}

async function notifyAdminsParseFailure(
  driverLineUserId: string,
  driverName: string,
  originalText: string,
  reason: string,
): Promise<void> {
  const supabase = createServiceClient()
  const { data: admins } = await supabase
    .from('user_profiles')
    .select('line_user_id, username, real_name')
    .in('role', ADMIN_ROLES)
    .not('line_user_id', 'is', null)

  const text =
    `[車趟解析失敗]\n` +
    `司機：${driverName}（LINE: ${driverLineUserId}）\n` +
    `原因：${reason}\n` +
    `原文：「${originalText}」`

  await Promise.all(
    (admins ?? [])
      .filter(a => a.line_user_id && a.line_user_id !== driverLineUserId)
      .map(a => push(a.line_user_id as string, [textMessage(text)])),
  )
}
