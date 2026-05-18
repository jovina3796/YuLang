import { createServiceClient } from '@/lib/supabase/service'
import { buildCsv } from '@/lib/csv'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('vendors')
    .select('name, warehouse, contact_name, phone, payment_terms, billing_cycle_start_day, payment_delay_months, display_order')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('name')
  if (error) return new Response(`fetch failed: ${error.message}`, { status: 500 })

  const headers = ['廠商名稱', '倉庫', '聯絡人', '電話', '付款條件', '計費起算日', '延後月數', '顯示順序']
  const rows = (data ?? []).map(v => [
    v.name,
    v.warehouse ?? '',
    v.contact_name ?? '',
    v.phone ?? '',
    v.payment_terms ?? '',
    v.billing_cycle_start_day ?? 1,
    v.payment_delay_months ?? 2,
    v.display_order ?? '',
  ])
  const body = buildCsv(headers, rows)

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="vendors.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
