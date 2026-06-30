'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

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

function normalizeType(s: string): 'income' | 'expense' | null {
  const v = s.trim().toLowerCase()
  if (v === 'income'  || s.includes('收入') || v === 'in')  return 'income'
  if (v === 'expense' || s.includes('支出') || v === 'out') return 'expense'
  return null
}

export async function importMiscCsv(csvText: string): Promise<{
  ok: boolean; inserted: number; errors: { line: number; reason: string }[]
}> {
  const supabase = createServiceClient()

  const text = csvText.replace(/^﻿/, '')
  const rows = parseCsv(text).filter(r => r.some(c => c.trim() !== ''))
  if (rows.length < 2) return { ok: false, inserted: 0, errors: [{ line: 0, reason: 'CSV 為空或缺標題列' }] }

  const header = rows[0].map(s => s.trim())
  const idx = (k: string) => header.indexOf(k)
  const required = ['日期', '類型', '金額']
  for (const k of required) if (idx(k) < 0) return { ok: false, inserted: 0, errors: [{ line: 1, reason: `缺少欄位：${k}` }] }

  const errors: { line: number; reason: string }[] = []
  const inserts: any[] = []

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const get = (k: string) => (idx(k) >= 0 ? (row[idx(k)] ?? '').trim() : '')
    const date    = get('日期')
    const typeRaw = get('類型')
    const amtStr  = get('金額')

    if (!date) { errors.push({ line: r + 1, reason: '日期空白' }); continue }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push({ line: r + 1, reason: `日期格式錯誤：${date}（應為 YYYY-MM-DD）` }); continue }

    const type = normalizeType(typeRaw)
    if (!type) { errors.push({ line: r + 1, reason: `類型無效：${typeRaw}（應為 收入/支出）` }); continue }

    const amount = amtStr ? Number(amtStr) : NaN
    if (!Number.isFinite(amount) || amount < 0) { errors.push({ line: r + 1, reason: `金額無效：${amtStr}` }); continue }

    const deductMonthRaw = get('扣款年月')
    let deductMonth: string | null = null
    if (deductMonthRaw) {
      if (/^\d{4}-\d{2}$/.test(deductMonthRaw)) deductMonth = `${deductMonthRaw}-01`
      else if (/^\d{4}-\d{2}-\d{2}$/.test(deductMonthRaw)) deductMonth = deductMonthRaw
      else { errors.push({ line: r + 1, reason: `扣款年月格式錯誤：${deductMonthRaw}（應為 YYYY-MM）` }); continue }
    }

    inserts.push({
      transaction_date: date,
      type,
      category:    get('類別')     || null,
      description: get('說明')     || null,
      amount,
      deduct_month: deductMonth,
      notes:       get('備註')     || null,
      receipt_url: get('單據網址') || null,
      // ★ 新增讀取 CSV 中的司機與車輛 ID (如果你的 CSV 有這兩個欄位的話)
      driver_id:   get('司機ID')   || null,
      vehicle_id:  get('車輛ID')   || null,
    })
  }

  if (inserts.length === 0) return { ok: false, inserted: 0, errors }

  const { error } = await supabase.from('misc_transactions').insert(inserts)
  if (error) return { ok: false, inserted: 0, errors: [...errors, { line: 0, reason: `寫入失敗：${error.message}` }] }

  revalidatePath('/misc')
  return { ok: errors.length === 0, inserted: inserts.length, errors }
}
