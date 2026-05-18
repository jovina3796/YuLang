import { createServiceClient } from '@/lib/supabase/service'
import { buildCsv } from '@/lib/csv'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('vendor_rate_rules')
    .select('service_type, destination_area, pricing_mode, base_trips, base_fare, kpi_fare, base_stops, surcharge_per_stop, special_rate, special_rate_note, upstream_commission, upstream_commission_2, commission_mode, seasonal_note, is_active, is_service_default, display_order, vendors(name, warehouse)')
    .order('vendor_id')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('service_type')
  if (error) return new Response(`fetch failed: ${error.message}`, { status: 500 })

  const headers = [
    '廠商', '倉庫', '業務類別', '地區', '計費方式',
    '基本趟數', '基本運費', 'KPI運費', '基本點數', '超點費',
    '特殊加成', '加成備註', '上游抽成1', '上游抽成2', '抽成模式',
    '季節備註', '啟用', '預設規則', '顯示順序',
  ]
  const rows = (data ?? []).map((r: any) => {
    const v = Array.isArray(r.vendors) ? r.vendors[0] : r.vendors
    return [
      v?.name ?? '',
      v?.warehouse ?? '',
      r.service_type ?? '',
      r.destination_area ?? '',
      r.pricing_mode ?? '',
      r.base_trips ?? 1,
      r.base_fare ?? '',
      r.kpi_fare ?? '',
      r.base_stops ?? '',
      r.surcharge_per_stop ?? '',
      r.special_rate ?? '',
      r.special_rate_note ?? '',
      r.upstream_commission ?? '',
      r.upstream_commission_2 ?? '',
      r.commission_mode ?? 'single',
      r.seasonal_note ?? '',
      r.is_active ? 'Y' : 'N',
      r.is_service_default ? 'Y' : 'N',
      r.display_order ?? '',
    ]
  })
  const body = buildCsv(headers, rows)

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rate_rules.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
