import { createServiceClient } from '@/lib/supabase/service'

// 全域保底預設值 (萬一廠商跟司機沒設任何數值，預設用 10%)
const GLOBAL_DEFAULT_RATE = 10.00

export async function calculateTripCommission(driverId: string, vendorId: string, rawFare: number) {
  const supabase = createServiceClient()

  let rate = GLOBAL_DEFAULT_RATE

  // 1. 最高優先：查是否有「指定司機 + 指定廠商」的例外規則
  const { data: customRate } = await supabase
    .from('driver_vendor_rates')
    .select('commission_rate')
    .eq('driver_id', driverId)
    .eq('vendor_id', vendorId)
    .maybeSingle()

  if (customRate && customRate.commission_rate != null) {
    rate = Number(customRate.commission_rate)
  } else {
    // 2. 次要優先：查「該廠商」的預設抽成
    const { data: vendor } = await supabase
      .from('vendors')
      .select('default_commission_rate')
      .eq('id', vendorId)
      .maybeSingle()

    if (vendor && vendor.default_commission_rate != null) {
      rate = Number(vendor.default_commission_rate)
    }
  }

  // 計算抽成與實拿金額 (四捨五入到整數)
  const commissionAmount = Math.round(rawFare * (rate / 100))
  const driverFinalFare = rawFare - commissionAmount

  return {
    commission_rate: rate,
    driver_final_fare: driverFinalFare
  }
}
