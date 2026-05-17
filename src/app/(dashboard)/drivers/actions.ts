'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type DriverInput = {
  employee_no:          string | null
  name:                 string
  birth_date:           string | null
  id_number:            string | null
  phone:                string | null
  household_address:    string | null
  mail_address:         string | null
  email:                string | null
  license_type:         string | null
  license_renewal_date: string | null
  hire_date:            string | null
  leave_date:           string | null
  labor_insurance:      string | null
  health_insurance:     string | null
  line_user_id:         string | null
  bank_name:            string | null
  bank_account:         string | null
  status:               string
  display_order:        number | null
}

export async function createDriver(input: DriverInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('drivers').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/drivers')
  return { error: null }
}

export async function updateDriver(id: string, input: DriverInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('drivers').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/drivers')
  return { error: null }
}

export async function deleteDriver(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('drivers').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/drivers')
  return { error: null }
}
