import { createServiceClient } from '@/lib/supabase/service'
import ReminderManagementClient from '@/components/ReminderManagementClient'

export const dynamic = 'force-dynamic'

export default async function ReminderSettingsPage() {
  const supabase = createServiceClient()

  // 一次撈取設定檔、群組表與在職司機表
  const [
    { data: settings },
    { data: groups },
    { data: drivers }
  ] = await Promise.all([
    // 1. 撈取所有系統設定，包含歡迎詞與提醒詞
    supabase.from('system_settings').select('key, value'),
    
    // 2. 撈取所有群組
    supabase.from('line_groups').select('*').order('created_at', { ascending: false }),
    
    // 3. 撈取在職司機，並包含提醒時間與開關狀態
    supabase
      .from('drivers')
      .select('id, name, line_user_id, daily_reminder_enabled, is_daily_reminder_enabled, daily_reminder_time')
      .eq('status', 'active')
      .order('name')
  ])

  // 抓出群組歡迎詞 (新群組綁定時發送)
  const welcomeSetting = settings?.find(s => s.key === 'group_welcome_msg')
  const initialWelcomeMsg = welcomeSetting?.value || '已成功綁定群組「{GroupName}」！\n系統每晚將會發送報趟提醒喔！ 🚛'

  // 抓出每日定時提醒詞 (Cron Job 每日推播使用)
  const reminderSetting = settings?.find(s => s.key === 'daily_reminder_msg')
  const initialReminderMsg = reminderSetting?.value || '辛苦了！\n請記得回報今日的車趟喔 🚛'

  return (
    <div style={{ padding: '24px 32px' }}>
      <ReminderManagementClient
        initialWelcomeMsg={initialWelcomeMsg}
        initialReminderMsg={initialReminderMsg} 
        groups={groups || []}
        drivers={drivers || []}
      />
    </div>
  )
}
