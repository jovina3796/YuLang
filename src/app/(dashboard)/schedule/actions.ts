'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type ScheduleInput = {
  driver_id:      string
  vehicle_id:     string | null
  scheduled_date: string
  shift:          string | null
  status:         string
}

export async function createSchedule(input: ScheduleInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('schedules').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/schedule'); revalidatePath('/dashboard')
  return { error: null }
}

export async function updateSchedule(id: string, input: ScheduleInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('schedules').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/schedule'); revalidatePath('/dashboard')
  return { error: null }
}

export async function deleteSchedule(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('schedules').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/schedule'); revalidatePath('/dashboard')
  return { error: null }
}

// Toggle a rest day (休) for a driver on a specific date.
// If a 休 entry exists, remove it. Otherwise insert one.
// Other shifts (e.g. 早/晚 class) are left untouched.
export async function toggleRestDay(driverId: string, date: string) {
  const supabase = createServiceClient()
  const { data: existing } = await supabase
    .from('schedules')
    .select('id, shift')
    .eq('driver_id', driverId)
    .eq('scheduled_date', date)

  const restRow = existing?.find(r => (r.shift ?? '').includes('休'))
  if (restRow) {
    const { error } = await supabase.from('schedules').delete().eq('id', restRow.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('schedules').insert({
      driver_id: driverId, vehicle_id: null,
      scheduled_date: date, shift: '休', status: 'scheduled',
    })
    if (error) return { error: error.message }
  }
  revalidatePath('/schedule'); revalidatePath('/dashboard')
  return { error: null }
}

// Bulk set rest days for a driver. Accepts an array of ISO date strings.
// Inserts a 休 entry for any date that doesn't already have one.
export async function bulkSetRestDays(driverId: string, dates: string[]) {
  const supabase = createServiceClient()
  if (dates.length === 0) return { error: null, inserted: 0 }

  const { data: existing } = await supabase
    .from('schedules')
    .select('scheduled_date, shift')
    .eq('driver_id', driverId)
    .in('scheduled_date', dates)

  const taken = new Set(
    (existing ?? []).filter(e => (e.shift ?? '').includes('休')).map(e => e.scheduled_date)
  )
  const toInsert = dates.filter(d => !taken.has(d)).map(d => ({
    driver_id: driverId, vehicle_id: null,
    scheduled_date: d, shift: '休', status: 'scheduled',
  }))
  if (toInsert.length === 0) return { error: null, inserted: 0 }

  const { error } = await supabase.from('schedules').insert(toInsert)
  if (error) return { error: error.message, inserted: 0 }
  revalidatePath('/schedule'); revalidatePath('/dashboard')
  return { error: null, inserted: toInsert.length }
}

