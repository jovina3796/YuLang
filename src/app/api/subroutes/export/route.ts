import { createServiceClient } from '@/lib/supabase/service'
import { buildCsv } from '@/lib/csv'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('subroute_aliases')
    .select('alias, billing_area')
    .order('billing_area')
    .order('alias')
  if (error) return new Response(`fetch failed: ${error.message}`, { status: 500 })

  const headers = ['配送區域', '地區']
  const rows = (data ?? []).map(a => [a.alias, a.billing_area])
  const body = buildCsv(headers, rows)

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="subroute_aliases.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
