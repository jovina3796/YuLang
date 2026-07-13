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
  rule:        RateRule
  area:        string | null
  stops:       number | null
  fare:        number
  vendor_label: string
  // 🌟 新增：紀錄這趟套用的特殊加成快照
  surcharge_name: string | null
  surcharge_rate: number
}

// 🌟 新增：定義從資料庫撈出來的特殊加成規則型別
type SurchargeRule = {
  vendor_id: string
  name: string
  keyword: string
  rate: number
}

const ADMIN_ROLES = ['admin', 'owner']

const DATE_TOKEN_RE = /^(今天|今日|昨天|昨日|\d{1,2}號|\d{1,2}月\d{1,2}[號日]?|\d{1,2}\/\d{1,2})(\s|$)/

// 🌟 新增：允許使用 + 號作為「今天」的極短快捷鍵
const QUICK_TODAY_RE = /^\+(\s*)/

const ASSIGN_DRIVER_HEAD_RE = /^指定司機[：:]\s*(\S+)\s+/
const ASSIGN_DRIVER_TAIL_RE = /\s+指定司機[：:]\s*(\S+)\s*$/

// 🌟 確保整份檔案只有這「唯一一個」 looksLikeTripText 函式
export function looksLikeTripText(text: string): boolean {
  const stripped = text.trim().replace(ASSIGN_DRIVER_HEAD_RE, '').replace(ASSIGN_DRIVER_TAIL_RE, '').trim()
  // 只要是日期開頭，或是 + 號開頭，才放行進入報趟解析器
  return DATE_TOKEN_RE.test(stripped) || QUICK_TODAY_RE.test(stripped)
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

  // 🌟 一次撈齊：費率規則、區域對照表，以及【啟用中的特殊加成規則】
  const [{ data: rulesRaw }, { data: aliasesRaw }, { data: surchargesRaw }] = await Promise.all([
    supabase
      .from('vendor_rate_rules')
      .select('id, vendor_id, service_type, destination_area, pricing_mode, base_trips, base_fare, kpi_fare, base_stops, surcharge_per_stop, special_rate, is_active, is_service_default, vendors(name, warehouse)')
      .eq('is_active', true),
    supabase.from('subroute_aliases').select('alias, billing_area'),
    supabase.from('vendor_surcharges').select('vendor_id, name, keyword, rate').eq('is_active', true),
  ])

  const rules = ((rulesRaw ?? []) as unknown) as Array<RateRule & { vendors: { name: string; warehouse: string | null } | { name: string; warehouse: string | null }[] | null }>
  const aliasMap = new Map<string, string>()
  for (const a of (aliasesRaw ?? []) as Array<{ alias: string; billing_area: string }>) {
    aliasMap.set(a.alias, a.billing_area)
  }
  
  const surcharges = (surchargesRaw ?? []) as SurchargeRule[]
  // 將所有合法的加成關鍵字抽出來，傳給解析器
  const activeSurchargeKeywords = Array.from(new Set(surcharges.map(s => s.keyword)))
  
  const services = Array.from(new Set(rules.map(r => r.service_type).filter(Boolean)))

  // 🌟 核心小魔術：如果司機是用 + 開頭，我們在背景偷偷幫他補上「今天 」
  if (QUICK_TODAY_RE.test(parseText)) {
    parseText = parseText.replace(QUICK_TODAY_RE, '今天 ')
  }

  // 🌟 將合法關鍵字傳給解析引擎
  const parsed = parseTripText(parseText, services, activeSurchargeKeywords)

  if (parsed.kind === 'error') {
    await replyParseFailure(lineUserId, replyToken, text, parsed.message, actingDriverName)
    return
  }

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
      
      // 🌟 尋找這趟車趟的廠商，是否剛好有觸發當天司機打的加成關鍵字
      let appliedSurchargeName: string | null = null
      let appliedSurchargeRate: number = 0
      
      // 如果司機在當天的訊息裡有打加成關鍵字
      if (day.surcharges && day.surcharges.length > 0) {
        // 從資料庫清單中，找看看有沒有「該廠商」且「關鍵字相符」的方案
        const matchingSurcharge = surcharges.find(
          s => s.vendor_id === r.rule.vendor_id && day.surcharges.includes(s.keyword)
        )
        if (matchingSurcharge) {
          appliedSurchargeName = matchingSurcharge.name
          appliedSurchargeRate = Number(matchingSurcharge.rate)
        }
      }

      // 🌟 呼叫剛升級的核心計價引擎（傳入颱風假等方案的加成比例）
      const { finalFare } = calcFare(
        r.rule, 
        1, 
        stops, 
        isKpi, 
        false, 
        appliedSurchargeRate
      )

      const vRaw = (r.rule as unknown as { vendors: { name: string; warehouse: string | null } | { name: string; warehouse: string | null }[] | null }).vendors
      const v = Array.isArray(vRaw) ? vRaw[0] ?? null : vRaw
      const vendorLabel = v ? `${v.name}${v.warehouse ? `／${v.warehouse}` : ''}` : ''
      
      // 🌟 加上特殊加成標記，如果有的話，顯示在 LINE 泡泡卡片上讓司機安心
      const finalVendorLabel = appliedSurchargeName ? `${vendorLabel} (${appliedSurchargeName})` : vendorLabel

      dayResolved.push({ 
        rule: r.rule, 
        area: t.area, 
        stops: t.stops, 
        fare: finalFare, 
        vendor_label: finalVendorLabel,
        surcharge_name: appliedSurchargeName,
        surcharge_rate: appliedSurchargeRate
      })
    }
    resolvedDays.push({ kind: 'trips', date: day.date, resolved: dayResolved })
  }

  if (errors.length > 0) {
    await replyParseFailure(lineUserId, replyToken, text, errors.join('；'), actingDriverName)
    return
  }

  const tripRows: Array<Record<string, unknown>> = []
  for (const day of resolvedDays) {
    if (day.kind !== 'trips' || day.resolved.length === 0) continue
    const departedIso = twDateToIso(day.date)
    const vehicleId = await resolveVehicleForDriver(actingDriverId, new Date(departedIso))
    
    for (const rt of day.resolved) {
      const fareInfo = await calculateTripCommission(
        actingDriverId,    
        rt.rule.vendor_id, 
        rt.fare            
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
        // 例外抽成紀錄
        commission_rate:   fareInfo.commission_rate,
        driver_final_fare: fareInfo.driver_final_fare,
        // 🌟 特殊方案加成紀錄 (颱風假等)
        surcharge_name:    rt.surcharge_name,
        surcharge_rate:    rt.surcharge_rate,
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

  for (const day of resolvedDays) {
    if (day.kind !== 'rest') continue
    await insertRestIfMissing(actingDriverId, day.date)
  }

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
