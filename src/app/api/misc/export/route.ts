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
  const from = searchParams.get('from') || ''
  const to   = searchParams.get('to')   || ''
  const type = searchParams.get('type') || ''

  let q = supabase
    .from('misc_transactions')
    .select('transaction_date, type, category, description, amount, deduct_month, notes, receipt_url')
    .order('transaction_date', { ascending: false })
    .limit(5000)

  if (from) q = q.gte('transaction_date', from)
  if (to)   q = q.lte('transaction_date', to)
  if (type === 'income' || type === 'expense') q = q.eq('type', type)

  const { data, error } = await q
  if (error) return new Response(`fetch failed: ${error.message}`, { status: 500 })

  const headers = ['日期', '類型', '類別', '說明', '金額', '扣款年月', '備註', '單據網址']

  const rows = (data ?? []).map((t: any) => [
    t.transaction_date ?? '',
    t.type === 'income' ? '收入' : t.type === 'expense' ? '支出' : '',
    t.category ?? '',
    t.description ?? '',
    t.amount ?? '',
    t.deduct_month ? String(t.deduct_month).slice(0, 7) : '',
    t.notes ?? '',
    t.receipt_url ?? '',
  ].map(csvField).join(','))

  const body = '﻿' + headers.join(',') + '\r\n' + rows.join('\r\n') + (rows.length ? '\r\n' : '')
  const fname = `misc_${from || 'all'}_${to || 'all'}.csv`
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'no-store',
    },
  })
}
