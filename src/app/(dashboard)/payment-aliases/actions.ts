'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type PaymentAliasInput = {
  alias:  string
  target: string
}

export async function createPaymentAlias(input: PaymentAliasInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('payment_aliases').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/fuel')
  return { error: null }
}

export async function updatePaymentAlias(id: string, input: PaymentAliasInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('payment_aliases').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/fuel')
  return { error: null }
}

export async function deletePaymentAlias(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('payment_aliases').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/fuel')
  return { error: null }
}
