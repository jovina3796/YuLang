'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

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
  revalidatePath('/vendors')
  return { error: null }
}

export async function updateVendor(id: string, input: VendorInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('vendors').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/vendors')
  return { error: null }
}

export async function deleteVendor(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('vendors').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/vendors')
  return { error: null }
}
