// Shared trip-fare calculator used by LINE flows and the LIFF API.
// (TripFormModal.tsx has its own historical copy with the same logic.)

export type FareRule = {
  pricing_mode:       string
  base_trips:         number | null
  base_fare:          number | null
  kpi_fare:           number | null
  base_stops:         number | null
  surcharge_per_stop: number | null
  special_rate:       number | null
}

export function calcFare(
  rule: FareRule,
  tripCount: number,
  stops: number,
  isKpi: boolean,
  isSpecial: boolean,
  // 🌟 1. 新增擴充參數：預設值設好，避免舊程式碼馬上報錯
  surchargeRate: number = 0,         // 特殊方案加成 (例：颱風假 30% 傳入 0.3)
  driverCommissionRate: number = 10  // 司機抽成率 (預設 10%)
) {
  let fare = 0
  const bundle  = Math.max(1, rule.base_trips ?? 1)
  const bundles = Math.ceil(tripCount / bundle)
  switch (rule.pricing_mode) {
    case 'flat':
      fare = (rule.base_fare ?? 0) * bundles; break
    case 'base_or_kpi': {
      const base  = isKpi ? (rule.kpi_fare ?? rule.base_fare ?? 0) : (rule.base_fare ?? 0)
      const extra = stops > (rule.base_stops ?? 0)
        ? (stops - (rule.base_stops ?? 0)) * (rule.surcharge_per_stop ?? 0) : 0
      fare = base * bundles + extra; break
    }
    case 'per_stop_count':
      fare = stops * (rule.surcharge_per_stop ?? 0); break
    case 'pure_surcharge':
      fare = ((rule.base_fare ?? 0) + stops * (rule.surcharge_per_stop ?? 0)) * bundles; break
  }
  
  // 原本的特殊費率加成
  if (isSpecial && rule.special_rate) fare = fare * (1 + rule.special_rate)
  
  // --- 🌟 2. 核心注入：套用全新的「特殊方案加成」(例：颱風假乘上 1.3) ---
  if (surchargeRate > 0) fare = fare * (1 + surchargeRate)
  
  // 四捨五入到整數，得到最終的上游原始總運費
  const finalFare = Math.round(fare)

  // --- 🌟 3. 根據最終運費，精準切帳司機實拿工資 ---
  // 司機實拿比例 = (100 - 抽成) / 100 (例：抽 10% 代表司機拿 90%)
  const driverShareRate = Math.max(0, (100 - driverCommissionRate) / 100)
  
  // 算出司機最終實拿金額 (四捨五入)
  const driverFinalFare = Math.round(finalFare * driverShareRate)

  // 🌟 4. 改為回傳物件，讓呼叫端可以一次拿到兩個數字
  return {
    finalFare,
    driverFinalFare
  }
}
