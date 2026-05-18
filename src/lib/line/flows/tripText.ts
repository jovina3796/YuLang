import { createServiceClient } from '@/lib/supabase/service'
import { reply, push, textMessage, flexMessage } from '@/lib/line/api'
import { tripFormTriggerBubble } from '@/lib/line/flex'
import { resolveVehicleForDriver } from '@/lib/line/vehicleResolve'
import { calcFare, type FareRule } from '@/lib/fare'
import {
  parseTripText,
  twDateToIso,
  twDateToYmd,
  type ParsedTrip,
  type TwDate,
} from '@/lib/line/tripTextParse'

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
const DATE_TOKEN_RE = /^(今天|今日|昨天|昨日|\d{1,2}號|\d{1,2}月\d{1,2}[號日]|\d{1,2}\/\d{1,2})(\s|$)/

export function looksLikeTripText(text: string): boolean {
  return DATE_TOKEN_RE.test(text.trim())
}

export async function handleTripText(
  driverId: string,
  driverName: string,
  lineUserId: string,
  replyToken: string,
  text: string,
): Promise<void> {
  const supabase = createServiceClient()

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

  const parsed = parseTripText(text, services)

  if (parsed.kind === 'error') {
    await replyParseFailure(lineUserId, replyToken, text, parsed.message, driverName)
    return
  }

  if (parsed.kind === 'rest') {
    await handleRest(driverId, driverName, parsed.date, replyToken)
    return
  }

  // Resolve every parsed trip → rate_rule + fare
  const resolved: ResolvedTrip[] = []
  const errors: string[] = []
  for (const t of parsed.trips) {
    const r = resolveRule(t, rules, aliasMap)
    if ('error' in r) { errors.push(r.error); continue }
    const stops = t.stops ?? 0
    const isKpi = r.rule.pricing_mode === 'base_or_kpi' ? true : false
    const fare = calcFare(r.rule, 1, stops, isKpi, false)
    const vRaw = (r.rule as unknown as { vendors: { name: string; warehouse: string | null } | { name: string; warehouse: string | null }[] | null }).vendors
    const v = Array.isArray(vRaw) ? vRaw[0] ?? null : vRaw
    const vendorLabel = v ? `${v.name}${v.warehouse ? `／${v.warehouse}` : ''}` : ''
    resolved.push({ rule: r.rule, area: t.area, stops: t.stops, fare, vendor_label: vendorLabel })
  }

  if (errors.length > 0) {
    await replyParseFailure(lineUserId, replyToken, text, errors.join('；'), driverName)
    return
  }

  const vehicleId = await resolveVehicleForDriver(driverId, new Date(twDateToIso(parsed.date)))
  const departedIso = twDateToIso(parsed.date)

  const rows = resolved.map(rt => ({
    vendor_id:        rt.rule.vendor_id,
    rate_rule_id:     rt.rule.id,
    driver_id:        driverId,
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
  }))

  const { error: insErr } = await supabase.from('trips').insert(rows)
  if (insErr) {
    console.error('[line.tripText] insert failed', insErr)
    await reply(replyToken, [textMessage(`寫入失敗：${insErr.message}`)])
    return
  }

  await reply(replyToken, [textMessage(buildSuccessSummary(parsed.date, resolved))])
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

async function handleRest(
  driverId: string,
  driverName: string,
  date: TwDate,
  replyToken: string,
): Promise<void> {
  const supabase = createServiceClient()
  const ymd = twDateToYmd(date)
  const { data: existing } = await supabase
    .from('schedules')
    .select('id, shift')
    .eq('driver_id', driverId)
    .eq('scheduled_date', ymd)

  const restRow = (existing ?? []).find(r => (r.shift ?? '').includes('休'))
  if (!restRow) {
    const { error } = await supabase.from('schedules').insert({
      driver_id:      driverId,
      vehicle_id:     null,
      scheduled_date: ymd,
      shift:          '休',
      status:         'scheduled',
    })
    if (error) {
      console.error('[line.tripText] rest insert failed', error)
      await reply(replyToken, [textMessage(`寫入休假失敗：${error.message}`)])
      return
    }
  }
  await reply(replyToken, [textMessage(`✓ 已登記休假\n司機：${driverName}\n日期：${ymd}`)])
}

function buildSuccessSummary(date: TwDate, trips: ResolvedTrip[]): string {
  const lines: string[] = []
  lines.push(`✓ 已記錄 ${trips.length} 筆車趟`)
  lines.push(`日期：${twDateToYmd(date)}`)
  lines.push('')
  let total = 0
  trips.forEach((t, i) => {
    const seg: string[] = []
    seg.push(`${i + 1}.`)
    if (t.vendor_label) seg.push(t.vendor_label)
    seg.push(t.rule.service_type)
    if (t.area)        seg.push(t.area)
    if (t.stops != null) seg.push(`${t.stops}點`)
    seg.push(`$${t.fare.toLocaleString()}`)
    lines.push(seg.join(' '))
    total += t.fare
  })
  lines.push('')
  lines.push(`合計：$${total.toLocaleString()}`)
  return lines.join('\n')
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

  const messages = [
    textMessage(`❌ 車趟回報解析失敗\n原因：${reason}\n原文：「${originalText}」\n\n建議改用 LIFF 表單回報。`),
  ]
  if (liffUrl) messages.push(flexMessage('車趟回報', tripFormTriggerBubble(liffUrl)))
  await reply(replyToken, messages)

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
