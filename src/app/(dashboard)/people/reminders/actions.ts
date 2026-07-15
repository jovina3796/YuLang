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
  revalidatePath('/people/reminders') 
  return { error: null }
}

// 2. 修改 LINE 群組的顯示備註名稱
export async function updateGroupName(id: string, name: string) {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('line_groups')
    .update({ name: name.trim() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/people/reminders') 
  return { error: null }
}

// 3. 🌟 新版：更新 LINE 群組提醒時間與開關
export async function updateGroupReminderSettings(id: string, enabled: boolean, timeStr: string) {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('line_groups')
    .update({ 
      is_reminder_enabled: enabled,
      reminder_time: `${timeStr}:00` // 轉換為 Postgres TIME 格式
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/people/reminders') 
  return { error: null }
}

// 4. 🌟 新版：更新個別司機提醒時間與開關
export async function updateDriverReminderSettings(id: string, enabled: boolean, timeStr: string) {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('drivers')
    .update({ 
      is_daily_reminder_enabled: enabled,
      daily_reminder_time: `${timeStr}:00` // 轉換為 Postgres TIME 格式
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/people/reminders') 
  return { error: null }
}
