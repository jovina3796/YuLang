import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { push, textMessage } from '@/lib/line/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
  const nowHour = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).getHours();

  // 獲取提醒詞
  const { data: settings } = await supabase.from('system_settings').select('key, value')
  const reminderMsg = settings?.find(s => s.key === 'daily_reminder_msg')?.value || '請記得回報今日車趟喔！'

  let successCount = 0

  // 1. 處理司機 (檢查：已啟用、今天沒發過、現在時間 >= 設定時間)
  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, name, line_user_id, daily_reminder_time, last_reminder_date')
    .eq('is_daily_reminder_enabled', true)
    .not('line_user_id', 'is', null)

  for (const d of (drivers || [])) {
    const dbHour = d.daily_reminder_time ? parseInt(d.daily_reminder_time.split(':')[0]) : 20;
    if (d.last_reminder_date !== today && nowHour >= dbHour) {
      try {
        await push(d.line_user_id, [textMessage(`晚安 ${d.name}！🌙\n${reminderMsg}`)])
        await supabase.from('drivers').update({ last_reminder_date: today }).eq('id', d.id)
        successCount++
      } catch (err) { console.error(err) }
    }
  }

  // 2. 處理群組 (同理)
  const { data: groups } = await supabase
    .from('line_groups')
    .select('id, name, line_group_id, reminder_time, last_reminder_date')
    .eq('is_reminder_enabled', true)

  for (const g of (groups || [])) {
    const dbHour = g.reminder_time ? parseInt(g.reminder_time.split(':')[0]) : 20;
    if (g.last_reminder_date !== today && nowHour >= dbHour) {
      try {
        await push(g.line_group_id, [textMessage(reminderMsg.replace('{GroupName}', g.name))])
        await supabase.from('line_groups').update({ last_reminder_date: today }).eq('id', g.id)
        successCount++
      } catch (err) { console.error(err) }
    }
  }

  return NextResponse.json({ ok: true, sent: successCount, date: today })
}
