'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { parseCsv } from '@/lib/csv'

export async function importSubroutesCsv(csvText: string): Promise<{
  ok: boolean; inserted: number; updated: number; errors: { line: number; reason: string }[]
}> {
  const supabase = createServiceClient()
  const rows = parseCsv(csvText)
  if (rows.length < 2) return { ok: false, inserted: 0, updated: 0, errors: [{ line: 0, reason: 'CSV 為空或缺標題列' }] }

  const header = rows[0].map(s => s.trim())
  const aliasIdx   = header.indexOf('配送區域')
  const billingIdx = header.indexOf('地區')
  if (aliasIdx < 0 || billingIdx < 0) {
    return { ok: false, inserted: 0, updated: 0, errors: [{ line: 1, reason: '缺少欄位：配送區域 / 地區' }] }
  }

  const errors: { line: number; reason: string }[] = []
  const upserts: { alias: string; billing_area: string }[] = []
  const seen = new Set<string>()

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const alias   = (row[aliasIdx]   ?? '').trim()
    const billing = (row[billingIdx] ?? '').trim()
    if (!alias || !billing) { errors.push({ line: r + 1, reason: '配送區域或地區空白' }); continue }
    if (seen.has(alias)) { errors.push({ line: r + 1, reason: `配送區域「${alias}」在 CSV 中重複` }); continue }
    seen.add(alias)
    upserts.push({ alias, billing_area: billing })
  }

  if (upserts.length === 0) return { ok: false, inserted: 0, updated: 0, errors }

  // Count inserts vs updates by checking existing aliases
  const { data: existing } = await supabase
    .from('subroute_aliases')
    .select('alias')
    .in('alias', upserts.map(u => u.alias))
  const existingSet = new Set((existing ?? []).map(e => e.alias))
  const insertedCount = upserts.filter(u => !existingSet.has(u.alias)).length
  const updatedCount  = upserts.length - insertedCount

  const { error } = await supabase
    .from('subroute_aliases')
    .upsert(upserts.map(u => ({ ...u, updated_at: new Date().toISOString() })), { onConflict: 'alias' })
  if (error) return { ok: false, inserted: 0, updated: 0, errors: [...errors, { line: 0, reason: `寫入失敗：${error.message}` }] }

  revalidatePath('/vendor-info/subroutes')
  return { ok: errors.length === 0, inserted: insertedCount, updated: updatedCount, errors }
}
