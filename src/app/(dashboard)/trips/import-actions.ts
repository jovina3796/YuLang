'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
// 🌟 引入我們新增的抽成計算工具
import { calculateTripCommission } from '@/lib/finance/commission'

type ParsedRow = {
  line:        number
  date:        string
  vendorName:  string
  warehouse:   string
  serviceType: string
  area:        string
  tripCount:   number
  driverName:  string
  plate:       string
  actualStops: number | null
  destNote:    string
  finalFare:   number | null
  isKpi:       boolean | null
  isSpecial:   boolean
  notes:       string
}

type RuleFull = {
  id: string; vendor_id: string; service_type: string; destination_area: string | null
  base_trips: number | null; base_fare: number | null; kpi_fare: number | null
  base_stops: number | null; surcharge_per_stop: number | null
  pricing_mode: string
}

function calcFare(rule: RuleFull, tripCount: number, stops: number, isKpi: boolean, isSpecial: boolean) {
  let fare = 0
  const bundle  = Math.max(1, rule.base_trips ?? 1)
  const bundles = Math.ceil(tripCount / bundle)
  switch (rule.pricing_mode) {
    case 'flat':
      fare = (rule.base_fare ?? 0) * bundles; break
    case 'base_or_kpi': {
      const base  = isKpi ? (rule.kpi_fare ?? rule.base_fare ?? 0) : (rule.base_fare ?? 0)
      const extra = stops > (rule.base_stops ?? 0)
        ? (stops - (rule.base_stops ?? 0)) * (rule.surcharge_per_stop ?? 0) : 0
      fare = base * bundles + extra; break
    }
    case 'per_stop_count':
      fare = stops * (rule.surcharge_per_stop ?? 0); break
    case 'pure_surcharge':
      fare = ((rule.base_fare ?? 0) + stops * (rule.surcharge_per_stop ?? 0)) * bundles; break
  }
  if (isSpecial) fare = fare * 1.3
  return Math.round(fare)
}

function parseCsv(text: string): string[][] {
  const out: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += c; i++
    } else {
      if (c === '"') { inQuotes = true; i++; continue }
      if (c === ',') { cur.push(field); field = ''; i++; continue }
      if (c === '\r') { i++; continue }
      if (c === '\n') { cur.push(field); out.push(cur); cur = []; field = ''; i++; continue }
      field += c; i++
    }
  }
  if (field !== '' || cur.length > 0) { cur.push(field); out.push(cur) }
  return out
}

export async function importTripsCsv(csvText: string): Promise<{
  ok: boolean; inserted: number; errors: { line: number; reason: string }[]
}> {
  const supabase = createServiceClient()

  const text = csvText.replace(/^﻿/, '')
  const rows = parseCsv(text).filter(r => r.some(c => c.trim() !== ''))
  if (rows.length < 2) return { ok: false, inserted: 0, errors: [{ line: 0, reason: 'CSV 為空或缺標題列' }] }

  const header = rows[0].map(s => s.trim())
  const idx = (k: string) => header.indexOf(k)
  const required = ['日期','廠商','業務類別','趟數']
  for (const k of required) if (idx(k) < 0) return { ok: false, inserted: 0, errors: [{ line: 1, reason: `缺少欄位：${k}` }] }

  const parsed: ParsedRow[] = []
  const errors: { line: number; reason: string }[] = []

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const get = (k: string) => (idx(k) >= 0 ? (row[idx(k)] ?? '').trim() : '')
    const date = get('日期')
    const vendorName = get('廠商')
    if (!date || !vendorName) { errors.push({ line: r + 1, reason: '日期或廠商空白' }); continue }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push({ line: r + 1, reason: `日期格式錯誤：${date}（應為 YYYY-MM-DD）` }); continue }
    const tripCountStr = get('趟數')
    const tripCount = tripCountStr ? Number(tripCountStr) : 1
    if (!Number.isFinite(tripCount) || tripCount < 1) { errors.push({ line: r + 1, reason: `趟數無效：${tripCountStr}` }); continue }
    const stopsStr = get('配送點數')
    const fareStr  = get('運費')
    const kpiStr   = get('KPI達標')
    const specStr  = get('加成費')
    parsed.push({
      line:        r + 1,
      date,
      vendorName,
      warehouse:   get('倉庫'),
      serviceType: get('業務類別'),
      area:        get('地區'),
      tripCount,
      driverName:  get('司機'),
      plate:       get('車號'),
      actualStops: stopsStr === '' ? null : Number(stopsStr),
      destNote:    get('配送區域備註'),
      finalFare:   fareStr === '' ? null : Number(fareStr),
      isKpi:       kpiStr === '' ? null : /^[YyTt1]/.test(kpiStr),
      isSpecial:   specStr === '' ? false : /^[YyTt1]/.test(specStr),
      notes:       get('備註'),
    })
  }

  if (parsed.length === 0) return { ok: false, inserted: 0, errors: errors.length ? errors : [{ line: 0, reason: '沒有可匯入的資料列' }] }

  // Lookup tables (rules include pricing fields for auto-calc)
  const [{ data: vendors }, { data: rules }, { data: drivers }, { data: vehicles }] = await Promise.all([
    supabase.from('vendors').select('id, name, warehouse'),
    supabase.from('vendor_rate_rules')
      .select('id, vendor_id, service_type, destination_area, base_trips, base_fare, kpi_fare, base_stops, surcharge_per_stop, pricing_mode'),
    supabase.from('drivers').select('id, name'),
    supabase.from('vehicles').select('id, plate_number'),
  ])

  const vendorKey = (n: string, w: string) => `${n}|${w}`
  const vendorMap = new Map<string, string>()
  ;(vendors ?? []).forEach(v => {
    vendorMap.set(vendorKey(v.name, v.warehouse ?? ''), v.id)
    if (!v.warehouse) vendorMap.set(vendorKey(v.name, ''), v.id)
  })

  const ruleByKey = new Map<string, RuleFull>()
  ;(rules ?? []).forEach((r: any) => {
    ruleByKey.set(`${r.vendor_id}|${r.service_type}|${r.destination_area ?? ''}`, r)
  })

  const driverMap = new Map<string, string>()
  ;(drivers ?? []).forEach(d => driverMap.set(d.name, d.id))

  const vehicleMap = new Map<string, string>()
  ;(vehicles ?? []).forEach(v => vehicleMap.set(v.plate_number, v.id))

  const inserts: any[] = []

  for (const p of parsed) {
    let vid = vendorMap.get(vendorKey(p.vendorName, p.warehouse))
    if (!vid && !p.warehouse) vid = vendorMap.get(vendorKey(p.vendorName, ''))
    if (!vid) { errors.push({ line: p.line, reason: `找不到廠商：${p.vendorName}${p.warehouse ? '／'+p.warehouse : ''}` }); continue }

    const rule = ruleByKey.get(`${vid}|${p.serviceType}|${p.area}`)
    if (!rule) { errors.push({ line: p.line, reason: `找不到運費規則：${p.serviceType}${p.area ? `（${p.area}）` : ''}` }); continue }

    const stops    = p.actualStops ?? 0
    const isKpi    = p.isKpi ?? true
    const computed = calcFare(rule, p.tripCount, stops, isKpi, p.isSpecial)
    const finalFare = p.finalFare != null && Number.isFinite(p.finalFare) ? p.finalFare : computed

    const driverId  = p.driverName ? driverMap.get(p.driverName)  ?? null : null
    const vehicleId = p.plate      ? vehicleMap.get(p.plate)       ?? null : null

    inserts.push({
      vendor_id:        vid,
      rate_rule_id:     rule.id,
      driver_id:        driverId,
      vehicle_id:       vehicleId,
      destination_area: p.destNote || null,
      departed_at:      new Date(`${p.date}T00:00:00`).toISOString(),
      actual_stops:     p.actualStops,
      is_kpi_achieved:  rule.pricing_mode === 'base_or_kpi' ? isKpi : null,
      calculated_fare:  computed,
      final_fare:       finalFare,
      trip_count:       p.tripCount,
      notes:            p.notes || null,
      status:           'completed',
    })
  }

  if (inserts.length === 0) return { ok: false, inserted: 0, errors }

  // 🌟 新增：批次處理每一筆匯入的車趟，自動抓取該司機與廠商對應的抽成 % 與金額
  const insertsWithCommission = await Promise.all(
    inserts.map(async (row) => {
      const fare = row.final_fare ?? row.calculated_fare ?? 0
      if (row.driver_id && fare > 0) {
        const fareInfo = await calculateTripCommission(row.driver_id, row.vendor_id, fare)
        return {
          ...row,
          commission_rate: fareInfo.commission_rate,
          driver_final_fare: fareInfo.driver_final_fare,
        }
      }
      return row
    })
  )

  // 🌟 修改：將計算完成的 insertsWithCommission 寫入資料庫
  const { error } = await supabase.from('trips').insert(insertsWithCommission)
  if (error) return { ok: false, inserted: 0, errors: [...errors, { line: 0, reason: `寫入失敗：${error.message}` }] }

  revalidatePath('/trips')
  return { ok: errors.length === 0, inserted: insertsWithCommission.length, errors }
}
