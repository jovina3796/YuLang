'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type VehicleInput = {
  plate_number:          string
  category:              string | null
  model:                 string | null
  manufacture_date:      string | null
  mileage:               number
  last_inspection_date:  string | null
  next_inspection_date:  string | null
  status:                string
  display_order:         number | null
}

export async function createVehicle(input: VehicleInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('vehicles').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/vehicles')
  return { error: null }
}

export async function updateVehicle(id: string, input: VehicleInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('vehicles').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/vehicles')
  return { error: null }
}

export async function deleteVehicle(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('vehicles').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/vehicles')
  return { error: null }
}
