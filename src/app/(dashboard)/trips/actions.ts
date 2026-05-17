'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentProfile } from '@/lib/auth'
import { loadScopeFor } from '@/lib/rolePermissions.server'

export type TripInput = {
  vendor_id:        string
  rate_rule_id:     string
  driver_id:        string | null
  vehicle_id:       string | null
  destination_area: string | null
  departed_at:      string
  actual_stops:     number | null
  is_kpi_achieved:  boolean | null
  is_special:       boolean
  calculated_fare:  number | null
  final_fare:       number | null
  trip_count:       number
  notes:            string | null
  status:           string
}

/**
 * Throws if the caller's role is restricted to 'self' scope on /trips.
 * Self-scoped roles (typically drivers) are read-only — admins manage trips.
 */
async function ensureCanMutateTrips() {
  const me = await getCurrentProfile()
  if (!me) return { error: '未登入' as const }
  const scope = await loadScopeFor(me.role, 'trips')
  if (scope === 'self') return { error: '權限不足：此角色無權異動車趟紀錄' as const }
  return { error: null }
}

export async function createTrip(input: TripInput) {
  const guard = await ensureCanMutateTrips()
  if (guard.error) return { error: guard.error }
  const supabase = createServiceClient()
  const { error } = await supabase.from('trips').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/trips')
  return { error: null }
}

export async function updateTrip(id: string, input: TripInput) {
  const guard = await ensureCanMutateTrips()
  if (guard.error) return { error: guard.error }
  const supabase = createServiceClient()
  const { error } = await supabase.from('trips').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/trips')
  return { error: null }
}

export async function deleteTrip(id: string) {
  const guard = await ensureCanMutateTrips()
  if (guard.error) return { error: guard.error }
  const supabase = createServiceClient()
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/trips')
  return { error: null }
}
