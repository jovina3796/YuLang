'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { parseCsv } from '@/lib/csv'

export type VendorInput = {
  name:                    string
  warehouse:               string
  contact_name:            string | null
  phone:                   string | null
  payment_terms:           string | null
  display_order:           number | null
  billing_cycle_start_day: number
  payment_delay_months:    number
}

export async function createVendor(input: VendorInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('vendors').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/vendor-info/vendors')
  return { error: null }
}

export async function updateVendor(id: string, input: VendorInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('vendors').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/vendor-info/vendors')
  return { error: null }
}

export async function deleteVendor(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('vendors').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/vendor-info/vendors')
  return { error: null }
}

export async function importVendorsCsv(csvText: string): Promise<{
  ok: boolean; inserted: number; updated: number; errors: { line: number; reason: string }[]
}> {
  const supabase = createServiceClient()
  const rows = parseCsv(csvText)
  if (rows.length < 2) return { ok: false, inserted: 0, updated: 0, errors: [{ line: 0, reason: 'CSV 為空或缺標題列' }] }

  const header = rows[0].map(s => s.trim())
  const idx = (k: string) => header.indexOf(k)
  if (idx('廠商名稱') < 0) return { ok: false, inserted: 0, updated: 0, errors: [{ line: 1, reason: '缺少必要欄位：廠商名稱' }] }

  const errors: { line: number; reason: string }[] = []
  type Parsed = { line: number; payload: VendorInput }
  const parsed: Parsed[] = []

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const get = (k: string) => (idx(k) >= 0 ? (row[idx(k)] ?? '').trim() : '')
    const name = get('廠商名稱')
    if (!name) { errors.push({ line: r + 1, reason: '廠商名稱空白' }); continue }
    const startDayStr = get('計費起算日')
    const delayStr    = get('延後月數')
    const orderStr    = get('顯示順序')
    const startDay = startDayStr ? Number(startDayStr) : 1
    const delay    = delayStr    ? Number(delayStr)    : 2
    if (!Number.isFinite(startDay) || startDay < 1 || startDay > 31) {
      errors.push({ line: r + 1, reason: `計費起算日無效：${startDayStr}` }); continue
    }
    if (!Number.isFinite(delay) || delay < 0) {
      errors.push({ line: r + 1, reason: `延後月數無效：${delayStr}` }); continue
    }
    parsed.push({
      line: r + 1,
      payload: {
        name,
        warehouse:               get('倉庫'),
        contact_name:            get('聯絡人') || null,
        phone:                   get('電話') || null,
        payment_terms:           get('付款條件') || null,
        billing_cycle_start_day: startDay,
        payment_delay_months:    delay,
        display_order:           orderStr ? Number(orderStr) : null,
      },
    })
  }

  if (parsed.length === 0) return { ok: false, inserted: 0, updated: 0, errors }

  const { data: existing } = await supabase
    .from('vendors')
    .select('id, name, warehouse')

  const key = (n: string, w: string) => `${n}|${w ?? ''}`
  const existingMap = new Map<string, string>()
  ;(existing ?? []).forEach(e => existingMap.set(key(e.name, e.warehouse ?? ''), e.id))

  let inserted = 0, updated = 0
  for (const p of parsed) {
    const k = key(p.payload.name, p.payload.warehouse ?? '')
    const id = existingMap.get(k)
    if (id) {
      const { error } = await supabase.from('vendors').update(p.payload).eq('id', id)
      if (error) { errors.push({ line: p.line, reason: `更新失敗：${error.message}` }); continue }
      updated++
    } else {
      const { error } = await supabase.from('vendors').insert(p.payload)
      if (error) { errors.push({ line: p.line, reason: `寫入失敗：${error.message}` }); continue }
      inserted++
    }
  }

  revalidatePath('/vendor-info/vendors')
  return { ok: errors.length === 0, inserted, updated, errors }
}
