'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

// 1. 更新系統設定 (例如：修改 LINE 歡迎詞範本)
export async function updateSystemSetting(key: string, value: string) {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('system_settings')
    .update({ value: value.trim() })
    .eq('key', key)

  if (error) return { error: error.message }
  revalidatePath('/vendor-info/reminders')
  return { error: null }
}

// 2. 快速切換 LINE 群組的提醒開關
export async function toggleGroupReminder(id: string, reminder_enabled: boolean) {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('line_groups')
    .update({ reminder_enabled })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/vendor-info/reminders')
  return { error: null }
}

// 3. 修改 LINE 群組的顯示備註名稱
export async function updateGroupName(id: string, name: string) {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('line_groups')
    .update({ name: name.trim() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/vendor-info/reminders')
  return { error: null }
}

// 4. 快速切換個別司機的每日提醒開關
export async function toggleDriverReminder(id: string, daily_reminder_enabled: boolean) {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('drivers')
    .update({ daily_reminder_enabled })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/vendor-info/reminders')
  return { error: null }
}
