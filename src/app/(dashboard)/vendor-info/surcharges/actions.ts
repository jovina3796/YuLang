'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type VendorSurchargeInput = {
  vendor_id:     string
  name:          string
  keyword:       string
  rate:          number
  is_active?:    boolean
  display_order?: number | null
}

// 1. 新增加成規則
export async function createVendorSurcharge(input: VendorSurchargeInput) {
  const supabase = createServiceClient()
  
  // 基本防呆驗證
  if (!input.vendor_id || !input.name.trim() || !input.keyword.trim()) {
    return { error: '廠商、加成名稱與關鍵字均為必填' }
  }
  
  const payload = {
    ...input,
    name: input.name.trim(),
    keyword: input.keyword.trim(),
    is_active: input.is_active ?? true,
    display_order: input.display_order ?? 10,
  }

  const { error } = await supabase.from('vendor_surcharges').insert(payload)
  
  if (error) {
    // 捕捉唯一鍵值衝突（同一個廠商不能設定兩個一模一樣的關鍵字）
    if (error.code === '23505') return { error: `該廠商已經設定過「${payload.keyword}」這個關鍵字了！` }
    return { error: error.message }
  }
  
  revalidatePath('/vendor-info/surcharges')
  return { error: null }
}

// 2. 更新加成規則
export async function updateVendorSurcharge(id: string, input: VendorSurchargeInput) {
  const supabase = createServiceClient()
  
  const payload = {
    ...input,
    name: input.name.trim(),
    keyword: input.keyword.trim(),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('vendor_surcharges').update(payload).eq('id', id)
  
  if (error) {
    if (error.code === '23505') return { error: `該廠商已經設定過「${payload.keyword}」這個關鍵字了！` }
    return { error: error.message }
  }
  
  revalidatePath('/vendor-info/surcharges')
  return { error: null }
}

// 3. 快速切換啟用/停用狀態 (颱風季專用！)
export async function toggleVendorSurcharge(id: string, is_active: boolean) {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('vendor_surcharges')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    
  if (error) return { error: error.message }
  revalidatePath('/vendor-info/surcharges')
  return { error: null }
}

// 4. 刪除加成規則
export async function deleteVendorSurcharge(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('vendor_surcharges').delete().eq('id', id)
  
  if (error) return { error: error.message }
  revalidatePath('/vendor-info/surcharges')
  return { error: null }
}
