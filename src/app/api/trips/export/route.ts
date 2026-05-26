import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

function csvField(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const from   = searchParams.get('from')   || ''
  const to     = searchParams.get('to')     || ''
  const vendor = searchParams.get('vendor') || ''

  const fromIso = from ? new Date(`${from}T00:00:00+08:00`).toISOString() : null
  const toIso   = to   ? new Date(`${to}T23:59:59.999+08:00`).toISOString() : null

  let q = supabase
    .from('trips')
    .select(`
      id, departed_at, trip_count, destination_area, actual_stops,
      final_fare, notes, is_kpi_achieved,
      vendors(name, warehouse),
      drivers(name),
      vehicles(plate_number),
      vendor_rate_rules!rate_rule_id(service_type, destination_area)
    `)
    .order('departed_at', { ascending: false, nullsFirst: false })
    .limit(5000)

  if (fromIso) q = q.gte('departed_at', fromIso)
  if (toIso)   q = q.lte('departed_at', toIso)
  if (vendor)  q = q.eq('vendor_id', vendor)

  const { data, error } = await q
  if (error) {
    return new Response(`fetch failed: ${error.message}`, { status: 500 })
  }

  const headers = [
    '日期','廠商','倉庫','業務類別','地區','趟數','司機','車號',
    '配送點數','配送區域備註','運費','KPI達標','加成費','備註',
  ]

  const rows = (data ?? []).map((t: any) => {
    const date = t.departed_at
      ? new Date(t.departed_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
      : ''
    return [
      date,
      t.vendors?.name      ?? '',
      t.vendors?.warehouse ?? '',
      t.vendor_rate_rules?.service_type     ?? '',
      t.vendor_rate_rules?.destination_area ?? '',
      t.trip_count ?? 1,
      t.drivers?.name           ?? '',
      t.vehicles?.plate_number  ?? '',
      t.actual_stops     ?? '',
      t.destination_area ?? '',
      t.final_fare       ?? '',
      t.is_kpi_achieved == null ? '' : t.is_kpi_achieved ? 'Y' : 'N',
      '',
      t.notes            ?? '',
    ].map(csvField).join(',')
  })

  const body = '﻿' + headers.join(',') + '\r\n' + rows.join('\r\n') + (rows.length ? '\r\n' : '')

  const fname = `trips_${from || 'all'}_${to || 'all'}.csv`
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'no-store',
    },
  })
}
