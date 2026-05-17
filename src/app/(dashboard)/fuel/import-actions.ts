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

export async function importFuelCsv(csvText: string): Promise<{
  ok: boolean; inserted: number; errors: { line: number; reason: string }[]
}> {
  const supabase = createServiceClient()

  const text = csvText.replace(/^﻿/, '')
  const rows = parseCsv(text).filter(r => r.some(c => c.trim() !== ''))
  if (rows.length < 2) return { ok: false, inserted: 0, errors: [{ line: 0, reason: 'CSV 為空或缺標題列' }] }

  const header = rows[0].map(s => s.trim())
  const idx = (k: string) => header.indexOf(k)
  const required = ['日期', '車號', '金額']
  for (const k of required) if (idx(k) < 0) return { ok: false, inserted: 0, errors: [{ line: 1, reason: `缺少欄位：${k}` }] }

  const { data: vehicles } = await supabase.from('vehicles').select('id, plate_number, mileage')
  const vehicleMap = new Map<string, { id: string; mileage: number }>()
  const vehicleById = new Map<string, { plate: string; mileage: number }>()
  ;(vehicles ?? []).forEach(v => {
    vehicleMap.set(v.plate_number, { id: v.id, mileage: v.mileage ?? 0 })
    vehicleById.set(v.id, { plate: v.plate_number, mileage: v.mileage ?? 0 })
  })

  const errors: { line: number; reason: string }[] = []
  const inserts: any[] = []
  const maxMileageByVehicle = new Map<string, number>()

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const get = (k: string) => (idx(k) >= 0 ? (row[idx(k)] ?? '').trim() : '')
    const date    = get('日期')
    const plate   = get('車號')
    const costStr = get('金額')

    if (!date || !plate) { errors.push({ line: r + 1, reason: '日期或車號空白' }); continue }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push({ line: r + 1, reason: `日期格式錯誤：${date}（應為 YYYY-MM-DD）` }); continue }
    const veh = vehicleMap.get(plate)
    if (!veh) { errors.push({ line: r + 1, reason: `找不到車號：${plate}` }); continue }

    const cost = costStr ? Number(costStr) : NaN
    if (!Number.isFinite(cost) || cost < 0) { errors.push({ line: r + 1, reason: `金額無效：${costStr}` }); continue }

    const mileageStr = get('目前里程')
    const mileage    = mileageStr === '' ? null : Number(mileageStr)
    if (mileageStr !== '' && !Number.isFinite(mileage)) { errors.push({ line: r + 1, reason: `里程無效：${mileageStr}` }); continue }

    if (mileage != null) {
      const prev = maxMileageByVehicle.get(veh.id) ?? -1
      if (mileage > prev) maxMileageByVehicle.set(veh.id, mileage)
    }

    inserts.push({
      vehicle_id:        veh.id,
      driver_id:         null,
      liters:            null,
      price_per_liter:   null,
      total_cost:        cost,
      mileage_at_refuel: mileage,
      station_name:      null,
      payment_method:    get('付款方式') || null,
      notes:             get('備註')     || null,
      logged_at:         new Date(`${date}T00:00:00`).toISOString(),
    })
  }

  if (inserts.length === 0) return { ok: false, inserted: 0, errors }

  const { error } = await supabase.from('fuel_logs').insert(inserts)
  if (error) return { ok: false, inserted: 0, errors: [...errors, { line: 0, reason: `寫入失敗：${error.message}` }] }

  for (const [vid, maxMileage] of maxMileageByVehicle) {
    const current = vehicleById.get(vid)?.mileage ?? 0
    if (maxMileage > current) {
      await supabase.from('vehicles').update({ mileage: maxMileage }).eq('id', vid)
    }
  }

  revalidatePath('/fuel')
  revalidatePath('/vehicles')
  return { ok: errors.length === 0, inserted: inserts.length, errors }
}
