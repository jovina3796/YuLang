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
  const from    = searchParams.get('from')    || ''
  const to      = searchParams.get('to')      || ''
  const vehicle = searchParams.get('vehicle') || ''

  let q = supabase
    .from('fuel_logs')
    .select('logged_at, mileage_at_refuel, total_cost, payment_method, notes, vehicles(plate_number)')
    .order('logged_at', { ascending: false })
    .limit(5000)

  if (from)    q = q.gte('logged_at', from)
  if (to)      q = q.lte('logged_at', `${to}T23:59:59.999`)
  if (vehicle) q = q.eq('vehicle_id', vehicle)

  const { data, error } = await q
  if (error) return new Response(`fetch failed: ${error.message}`, { status: 500 })

  const headers = ['日期', '車號', '目前里程', '金額', '付款方式', '備註']

  const rows = (data ?? []).map((l: any) => {
    const date = l.logged_at ? new Date(l.logged_at).toISOString().split('T')[0] : ''
    return [
      date,
      l.vehicles?.plate_number ?? '',
      l.mileage_at_refuel ?? '',
      l.total_cost ?? '',
      l.payment_method ?? '',
      l.notes ?? '',
    ].map(csvField).join(',')
  })

  const body = '﻿' + headers.join(',') + '\r\n' + rows.join('\r\n') + (rows.length ? '\r\n' : '')
  const fname = `fuel_${from || 'all'}_${to || 'all'}.csv`
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'no-store',
    },
  })
}
