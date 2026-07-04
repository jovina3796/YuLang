import { createServiceClient } from '@/lib/supabase/service'

// 全局保底預設值 (如果廠商沒設、司機也沒設，就用這個數值)
const GLOBAL_DEFAULT_RATE = 10.00

export async function resolveCommissionRate(driverId: string, vendorId: string): Promise<number> {
  const supabase = createServiceClient()

  // 1. 先查是否有「特定司機 × 特定廠商」的專屬設定
  const { data: customRate } = await supabase
    .from('driver_vendor_rates')
    .select('commission_rate')
    .eq('driver_id', driverId)
    .eq('vendor_id', vendorId)
    .maybeSingle()

  if (customRate && customRate.commission_rate != null) {
    return Number(customRate.commission_rate)
  }

  // 2. 如果沒有個別設定，查「廠商的預設值」
  const { data: vendor } = await supabase
    .from('vendors')
    .select('default_commission_rate')
    .eq('id', vendorId)
    .maybeSingle()

  if (vendor && vendor.default_commission_rate != null) {
    return Number(vendor.default_commission_rate)
  }

  // 3. 都沒有，使用系統全局預設值
  return GLOBAL_DEFAULT_RATE
}
