'use server'
import { createServiceClient } from '@/lib/supabase/service'

export interface TripPayload {
  vendor_id:        string
  rate_rule_id:     string
  driver_id:        string | null
  vehicle_id:       string | null
  destination_area: string | null
  departed_at:      string
  actual_stops:     number | null
  is_kpi_achieved:  boolean | null
  calculated_fare:  number | null
  final_fare:       number | null
  trip_count:       number
  notes:            string | null
  status:           string
}

export async function createTrip(payload: TripPayload) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('trips').insert(payload)
  if (error) throw new Error(error.message)
}
