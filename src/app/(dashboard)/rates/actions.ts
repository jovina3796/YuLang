'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type RateRuleInput = {
  vendor_id:             string
  service_type:          string
  destination_area:      string | null
  pricing_mode:          string
  base_trips:            number
  base_fare:             number | null
  kpi_fare:              number | null
  base_stops:            number | null
  surcharge_per_stop:    number | null
  special_rate:          number | null
  special_rate_note:     string | null
  upstream_commission:   number | null
  upstream_commission_2: number | null
  commission_mode:       string
  seasonal_note:         string | null
  is_active:             boolean
  display_order:         number | null
}

export async function createRateRule(input: RateRuleInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('vendor_rate_rules').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/rates')
  return { error: null }
}

export async function updateRateRule(id: string, input: RateRuleInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('vendor_rate_rules').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/rates')
  return { error: null }
}

export async function deleteRateRule(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('vendor_rate_rules').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/rates')
  return { error: null }
}
