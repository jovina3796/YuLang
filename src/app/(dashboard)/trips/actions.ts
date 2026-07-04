'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentProfile } from '@/lib/auth'
import { loadScopeFor } from '@/lib/rolePermissions.server'
// 🌟 1. 引入剛剛寫好的抽成計算工具
import { calculateTripCommission } from '@/lib/finance/commission'

export type TripInput = {
  vendor_id:        string
  rate_rule_id:     string
  driver_id:        string | null
  vehicle_id:       string | null
  destination_area: string | null
  departed_at:      string
  actual_stops:     number | null
  is_kpi_achieved:  boolean | null
  is_special:       boolean
  calculated_fare:  number | null
  final_fare:       number | null
  trip_count:       number
  notes:            string | null
  status:           string
  // 🌟 2. 擴充型別，允許帶入抽成欄位
  commission_rate?:   number | null
  driver_final_fare?: number | null
}

/**
 * Throws if the caller's role is restricted to 'self' scope on /trips.
 * Self-scoped roles (typically drivers) are read-only — admins manage trips.
 */
async function ensureCanMutateTrips() {
  const me = await getCurrentProfile()
  if (!me) return { error: '未登入' as const }
  const scope = await loadScopeFor(me.role, 'trips')
  if (scope === 'self') return { error: '權限不足：此角色無權異動車趟紀錄' as const }
  return { error: null }
}

// 🌟 內部輔助函式：幫 input 動態補上抽成與實拿金額
async function enrichTripInputWithCommission(input: TripInput): Promise<TripInput> {
  const fare = input.final_fare ?? input.calculated_fare ?? 0
  
  // 如果有指派司機且有金額，就自動計算該司機對廠商的專屬/預設抽成
  if (input.driver_id && fare > 0) {
    const fareInfo = await calculateTripCommission(input.driver_id, input.vendor_id, fare)
    return {
      ...input,
      commission_rate: fareInfo.commission_rate,
      driver_final_fare: fareInfo.driver_final_fare,
    }
  }
  return input
}

export async function createTrip(input: TripInput) {
  const guard = await ensureCanMutateTrips()
  if (guard.error) return { error: guard.error }
  
  // 🌟 3. 寫入前自動算好抽成
  const payload = await enrichTripInputWithCommission(input)
  
  const supabase = createServiceClient()
  const { error } = await supabase.from('trips').insert(payload)
  if (error) return { error: error.message }
  revalidatePath('/trips')
  return { error: null }
}

export async function updateTrip(id: string, input: TripInput) {
  const guard = await ensureCanMutateTrips()
  if (guard.error) return { error: guard.error }
  
  // 🌟 3. 更新前同樣自動重算抽成 (確保如果改了廠商、司機或運費，抽成會跟著連動更新！)
  const payload = await enrichTripInputWithCommission(input)
  
  const supabase = createServiceClient()
  const { error } = await supabase.from('trips').update(payload).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/trips')
  return { error: null }
}

export async function deleteTrip(id: string) {
  const guard = await ensureCanMutateTrips()
  if (guard.error) return { error: guard.error }
  const supabase = createServiceClient()
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/trips')
  return { error: null }
}
