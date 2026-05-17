'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

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

export async function createTrip(input: TripInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('trips').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/trips')
  return { error: null }
}

export async function updateTrip(id: string, input: TripInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('trips').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/trips')
  return { error: null }
}

export async function deleteTrip(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/trips')
  return { error: null }
}
