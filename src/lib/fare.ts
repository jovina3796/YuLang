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
): number {
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
  if (isSpecial && rule.special_rate) fare = fare * (1 + rule.special_rate)
  return Math.round(fare)
}
