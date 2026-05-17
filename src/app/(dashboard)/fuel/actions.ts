'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type FuelInput = {
  vehicle_id:        string
  driver_id:         string | null
  liters:            number | null
  price_per_liter:   number | null
  total_cost:        number | null
  mileage_at_refuel: number | null
  station_name:      string | null
  payment_method:    string | null
  notes:             string | null
  logged_at:         string
  receipt_url:       string | null
}

const BUCKET = 'fuel-receipts'

export async function uploadFuelReceipt(formData: FormData): Promise<{ url: string | null; error: string | null }> {
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { url: null, error: null }
  const supabase = createServiceClient()
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${Date.now()}-${rand}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined, upsert: false,
  })
  if (error) return { url: null, error: error.message }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

async function syncVehicleMileage(supabase: ReturnType<typeof createServiceClient>, vehicleId: string, mileage: number | null) {
  if (mileage == null || !vehicleId) return
  const { data: v } = await supabase.from('vehicles').select('mileage').eq('id', vehicleId).single()
  const current = v?.mileage ?? 0
  if (mileage > current) {
    await supabase.from('vehicles').update({ mileage }).eq('id', vehicleId)
    revalidatePath('/vehicles')
  }
}

export async function createFuelLog(input: FuelInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('fuel_logs').insert(input)
  if (error) return { error: error.message }
  await syncVehicleMileage(supabase, input.vehicle_id, input.mileage_at_refuel)
  revalidatePath('/fuel')
  return { error: null }
}

export async function updateFuelLog(id: string, input: FuelInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('fuel_logs').update(input).eq('id', id)
  if (error) return { error: error.message }
  await syncVehicleMileage(supabase, input.vehicle_id, input.mileage_at_refuel)
  revalidatePath('/fuel')
  return { error: null }
}

export async function deleteFuelLog(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('fuel_logs').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/fuel')
  return { error: null }
}
