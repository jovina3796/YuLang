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
  surchargeRate: number = 0,         // 特殊方案加成 (例：颱風假 30% 傳入 0.3)
  driverCommissionRate: number = 10  // 司機抽成率 (預設 10%)
) {
  // 🌟 將運費拆分為「基本費」與「超點費」兩個獨立區塊
  let baseFareTotal = 0
  let extraFareTotal = 0

  const bundle  = Math.max(1, rule.base_trips ?? 1)
  const bundles = Math.ceil(tripCount / bundle)

  switch (rule.pricing_mode) {
    case 'flat':
      baseFareTotal = (rule.base_fare ?? 0) * bundles
      break
    case 'base_or_kpi': {
      const base = isKpi ? (rule.kpi_fare ?? rule.base_fare ?? 0) : (rule.base_fare ?? 0)
      baseFareTotal = base * bundles
      
      const extraStops = stops > (rule.base_stops ?? 0) ? stops - (rule.base_stops ?? 0) : 0
      extraFareTotal = extraStops * (rule.surcharge_per_stop ?? 0)
      break
    }
    case 'per_stop_count':
      // 純算點數模式，全額視為基本費
      baseFareTotal = stops * (rule.surcharge_per_stop ?? 0)
      break
    case 'pure_surcharge':
      baseFareTotal = (rule.base_fare ?? 0) * bundles
      extraFareTotal = stops * (rule.surcharge_per_stop ?? 0) * bundles
      break
  }
  
  // 1. 原始總運費 = 基本費 + 超點費
  let fare = baseFareTotal + extraFareTotal
  
  // 2. 原本的特殊費率加成 (維持原邏輯，乘上總和)
  if (isSpecial && rule.special_rate) {
    fare = fare * (1 + rule.special_rate)
  }
  
  // 3. 🌟 關鍵修正：全新的「特殊方案加成」(例：颱風假)，只針對「基本費」加成！
  if (surchargeRate > 0) {
    fare += (baseFareTotal * surchargeRate)
  }
  
  // 四捨五入到整數，得到最終的上游原始總運費
  const finalFare = Math.round(fare)

  // 4. 根據最終運費與抽成比例，計算司機實拿工資
  // 司機實拿比例 = (100 - 抽成) / 100 (例：抽 10% 代表司機拿 90%)
  const driverShareRate = Math.max(0, (100 - driverCommissionRate) / 100)
  
  // 算出司機最終實拿金額 (四捨五入)
  const driverFinalFare = Math.round(finalFare * driverShareRate)

  return {
    finalFare,
    driverFinalFare
  }
}
