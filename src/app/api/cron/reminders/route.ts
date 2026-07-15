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
  
  // 🌟 1. 取得現在台灣時間 (HH:MM)
  const now = new Date();
  const taipeiOffset = 8 * 60 * 60 * 1000;
  const taipeiNow = new Date(now.getTime() + taipeiOffset);
  const currentHHMM = taipeiNow.toTimeString().slice(0, 5) + ":00"; // "HH:MM:00"

  // 🌟 2. 獲取系統設定的提醒詞
  const { data: settings } = await supabase.from('system_settings').select('key, value')
  const reminderMsg = settings?.find(s => s.key === 'daily_reminder_msg')?.value 
    || '大家辛苦了！\n請記得回報今日的車趟喔 🚛'

  let successCount = 0

  // ==========================================
  // 1. 發送私訊給個別司機 (檢查時間窗口)
  // ==========================================
  const { data: drivers } = await supabase
    .from('drivers')
    .select('name, line_user_id, daily_reminder_time')
    .eq('status', 'active')
    .eq('is_daily_reminder_enabled', true) // 🌟 記得對應新欄位名
    .not('line_user_id', 'is', null)

  for (const d of (drivers || [])) {
    // 簡單判斷：如果資料庫的時間跟現在很接近 (±8分鐘)
    if (d.daily_reminder_time && isTimeMatch(d.daily_reminder_time, currentHHMM)) {
      try {
        await push(d.line_user_id, [textMessage(`晚安 ${d.name}！🌙\n${reminderMsg}`)])
        successCount++
      } catch (err) { console.error(`私訊推播給 ${d.name} 失敗`, err) }
    }
  }

  // ==========================================
  // 2. 發送廣播給 LINE 群組 (檢查時間窗口)
  // ==========================================
  const { data: groups } = await supabase
    .from('line_groups')
    .select('name, line_group_id, reminder_time')
    .eq('is_reminder_enabled', true) // 🌟 記得對應新欄位名

  for (const g of (groups || [])) {
    if (g.reminder_time && isTimeMatch(g.reminder_time, currentHHMM)) {
      try {
        await push(g.line_group_id, [textMessage(reminderMsg.replace('{GroupName}', g.name))])
        successCount++
      } catch (err) { console.error(`群組推播給 ${g.name} 失敗`, err) }
    }
  }

  return NextResponse.json({ ok: true, sent: successCount, time: currentHHMM })
}

// 輔助函式：判斷時間是否在 8 分鐘誤差範圍內 (配合每 15 分鐘執行一次的 Cron)
function isTimeMatch(dbTime: string, currentHHMM: string) {
  // 簡單轉成總分鐘數比較
  const [h1, m1] = dbTime.split(':').map(Number)
  const [h2, m2] = currentHHMM.split(':').map(Number)
  const total1 = h1 * 60 + m1
  const total2 = h2 * 60 + m2
  return Math.abs(total1 - total2) <= 8 
}
