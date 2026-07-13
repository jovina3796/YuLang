import { createServiceClient } from '@/lib/supabase/service'
import ReminderManagementClient from '@/components/ReminderManagementClient'

export const dynamic = 'force-dynamic'

export default async function ReminderSettingsPage() {
  const supabase = createServiceClient()

  // 一次撈取設定檔、群組表與在職司機表
  const [
    { data: welcomeSetting },
    { data: groups },
    { data: drivers }
  ] = await Promise.all([
    supabase.from('system_settings').select('value').eq('key', 'group_welcome_msg').maybeSingle(),
    supabase.from('line_groups').select('*').order('created_at', { ascending: false }),
    supabase.from('drivers').select('id, name, line_user_id, daily_reminder_enabled').eq('status', 'active').order('name')
  ])

  const initialWelcomeMsg = welcomeSetting?.value || ''

  return (
    <ReminderManagementClient
      initialWelcomeMsg={initialWelcomeMsg}
      groups={groups || []}
      drivers={drivers || []}
    />
  )
}
