'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type DriverVendorRateInput = {
  driver_id:       string
  vendor_id:       string
  commission_rate: number
}

export async function upsertDriverVendorRate(input: DriverVendorRateInput) {
  const supabase = createServiceClient()
  if (!input.driver_id || !input.vendor_id) return { error: '請選擇司機與廠商' }
  if (!Number.isFinite(input.commission_rate) || input.commission_rate < 0 || input.commission_rate > 100) {
    return { error: '抽成比例須介於 0% ~ 100% 之間' }
  }

  // 透過 driver_id + vendor_id 唯一組合進行 upsert (新增或更新)
  const { error } = await supabase
    .from('driver_vendor_rates')
    .upsert({
      driver_id:       input.driver_id,
      vendor_id:       input.vendor_id,
      commission_rate: input.commission_rate,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'driver_id,vendor_id' })

  if (error) return { error: error.message }
  revalidatePath('/vendor-info/driver-rates')
  return { error: null }
}

export async function deleteDriverVendorRate(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('driver_vendor_rates').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/vendor-info/driver-rates')
  return { error: null }
}
