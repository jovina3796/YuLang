'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { parseCsv } from '@/lib/csv'

export type RateRuleInput = {
  vendor_id:             string
  service_type:          string
  destination_area:      string | null
  pricing_mode:          string
  base_trips:            number
  base_fare:             number | null
  kpi_fare:              number | null
  base_stops:            number | null
  surcharge_per_stop:    number | null
  special_rate:          number | null
  special_rate_note:     string | null
  upstream_commission:   number | null
  upstream_commission_2: number | null
  commission_mode:       string
  seasonal_note:         string | null
  is_active:             boolean
  is_service_default:    boolean
  display_order:         number | null
}

export async function createRateRule(input: RateRuleInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('vendor_rate_rules').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/vendor-info/rates')
  return { error: null }
}

export async function updateRateRule(id: string, input: RateRuleInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('vendor_rate_rules').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/vendor-info/rates')
  return { error: null }
}

export async function deleteRateRule(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('vendor_rate_rules').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/vendor-info/rates')
  return { error: null }
}

const VALID_PRICING = new Set(['flat', 'base_or_kpi', 'per_stop_count', 'pure_surcharge'])
const VALID_COMMISSION = new Set(['single', 'tier'])

function numOrNull(s: string): number | null {
  if (s.trim() === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function boolFromYn(s: string): boolean {
  return /^[YyTt1]/.test(s.trim())
}

export async function importRateRulesCsv(csvText: string): Promise<{
  ok: boolean; inserted: number; updated: number; errors: { line: number; reason: string }[]
}> {
  const supabase = createServiceClient()
  const rows = parseCsv(csvText)
  if (rows.length < 2) return { ok: false, inserted: 0, updated: 0, errors: [{ line: 0, reason: 'CSV 為空或缺標題列' }] }

  const header = rows[0].map(s => s.trim())
  const idx = (k: string) => header.indexOf(k)
  for (const k of ['廠商', '業務類別', '計費方式']) {
    if (idx(k) < 0) return { ok: false, inserted: 0, updated: 0, errors: [{ line: 1, reason: `缺少必要欄位：${k}` }] }
  }

  const { data: vendors } = await supabase.from('vendors').select('id, name, warehouse')
  const vendorKey = (n: string, w: string) => `${n}|${w ?? ''}`
  const vendorMap = new Map<string, string>()
  ;(vendors ?? []).forEach(v => vendorMap.set(vendorKey(v.name, v.warehouse ?? ''), v.id))

  const { data: existing } = await supabase
    .from('vendor_rate_rules')
    .select('id, vendor_id, service_type, destination_area')
  const ruleKey = (vid: string, svc: string, area: string) => `${vid}|${svc}|${area}`
  const existingMap = new Map<string, string>()
  ;(existing ?? []).forEach((r: any) => existingMap.set(ruleKey(r.vendor_id, r.service_type, r.destination_area ?? ''), r.id))

  const errors: { line: number; reason: string }[] = []
  type Parsed = { line: number; id: string | null; payload: RateRuleInput }
  const parsed: Parsed[] = []

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const get = (k: string) => (idx(k) >= 0 ? (row[idx(k)] ?? '').trim() : '')

    const vendorName = get('廠商')
    const warehouse  = get('倉庫')
    const svc        = get('業務類別')
    const area       = get('地區')
    const pricing    = get('計費方式')

    if (!vendorName || !svc || !pricing) {
      errors.push({ line: r + 1, reason: '廠商 / 業務類別 / 計費方式 不可為空' }); continue
    }
    if (!VALID_PRICING.has(pricing)) {
      errors.push({ line: r + 1, reason: `計費方式無效：${pricing}（可用 flat / base_or_kpi / per_stop_count / pure_surcharge）` }); continue
    }

    const vid = vendorMap.get(vendorKey(vendorName, warehouse))
    if (!vid) { errors.push({ line: r + 1, reason: `找不到廠商：${vendorName}${warehouse ? '／' + warehouse : ''}` }); continue }

    const baseTripsStr = get('基本趟數') || '1'
    const baseTrips = Number(baseTripsStr)
    if (!Number.isFinite(baseTrips) || baseTrips < 1) { errors.push({ line: r + 1, reason: `基本趟數無效：${baseTripsStr}` }); continue }

    const commissionMode = get('抽成模式') || 'single'
    if (!VALID_COMMISSION.has(commissionMode)) {
      errors.push({ line: r + 1, reason: `抽成模式無效：${commissionMode}` }); continue
    }

    const id = existingMap.get(ruleKey(vid, svc, area)) ?? null
    parsed.push({
      line: r + 1,
      id,
      payload: {
        vendor_id:             vid,
        service_type:          svc,
        destination_area:      area || null,
        pricing_mode:          pricing,
        base_trips:            baseTrips,
        base_fare:             numOrNull(get('基本運費')),
        kpi_fare:              numOrNull(get('KPI運費')),
        base_stops:            numOrNull(get('基本點數')),
        surcharge_per_stop:    numOrNull(get('超點費')),
        special_rate:          numOrNull(get('特殊加成')),
        special_rate_note:     get('加成備註') || null,
        upstream_commission:   numOrNull(get('上游抽成1')),
        upstream_commission_2: numOrNull(get('上游抽成2')),
        commission_mode:       commissionMode,
        seasonal_note:         get('季節備註') || null,
        is_active:             get('啟用') === '' ? true : boolFromYn(get('啟用')),
        is_service_default:    get('預設規則') === '' ? false : boolFromYn(get('預設規則')),
        display_order:         (() => { const v = get('顯示順序'); return v === '' ? null : Number(v) })(),
      },
    })
  }

  if (parsed.length === 0) return { ok: false, inserted: 0, updated: 0, errors }

  let inserted = 0, updated = 0
  for (const p of parsed) {
    if (p.id) {
      const { error } = await supabase.from('vendor_rate_rules').update(p.payload).eq('id', p.id)
      if (error) { errors.push({ line: p.line, reason: `更新失敗：${error.message}` }); continue }
      updated++
    } else {
      const { error } = await supabase.from('vendor_rate_rules').insert(p.payload)
      if (error) { errors.push({ line: p.line, reason: `寫入失敗：${error.message}` }); continue }
      inserted++
    }
  }

  revalidatePath('/vendor-info/rates')
  return { ok: errors.length === 0, inserted, updated, errors }
}
