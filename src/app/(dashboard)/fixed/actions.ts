'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type FixedExpenseInput = {
  name:        string
  category:    string | null
  amount:      number
  vehicle_id:  string | null
  notes:       string | null
  active:      boolean
  start_month: string | null
  end_month:   string | null
}

export async function createFixedExpense(input: FixedExpenseInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('fixed_expenses').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/fixed')
  revalidatePath('/reports')
  return { error: null }
}

export async function updateFixedExpense(id: string, input: FixedExpenseInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('fixed_expenses').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/fixed')
  revalidatePath('/reports')
  return { error: null }
}

export async function deleteFixedExpense(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('fixed_expenses').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/fixed')
  revalidatePath('/reports')
  return { error: null }
}
