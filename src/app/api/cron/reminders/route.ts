import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { push, textMessage } from '@/lib/line/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // 1. 安全驗證：確保是來自 Vercel Cron 的合法請求
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()
  
  // 取得正確的台灣時區當日日期 (格式為 YYYY-MM-DD)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });

  // 2. 獲取推播提醒詞 (完美對接前端設定的 daily_reminder_msg)
  const { data: settings } = await supabase.from('system_settings').select('key, value')
  const groupReminderMsg = settings?.find(s => s.key === 'group_reminder_msg')?.value || '提醒~ 今天回報車趟了嗎？'
  const driverReminderMsg = settings?.find(s => s.key === 'driver_reminder_msg')?.value || '提醒~ 今天回報車趟了嗎？'

  let successCount = 0

  // ==========================================
  // 3. 處理司機個人推播
  // 條件：在職 (active) + 開啟提醒 (is_daily_reminder_enabled) + 有綁定 LINE
  // ==========================================
  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, name, line_user_id, last_reminder_date')
    .eq('status', 'active')
    .eq('is_daily_reminder_enabled', true)
    .not('line_user_id', 'is', null)

  for (const d of (drivers || [])) {
    // 只要今天還沒發過就發送 (繞過 Vercel 執行時間不精準的問題)
    if (d.last_reminder_date !== today) {
      try {
        await push(d.line_user_id, [textMessage(`晚安 ${d.name}！🌙\n${driverReminderMsg}`)])
        await supabase.from('drivers').update({ last_reminder_date: today }).eq('id', d.id)
        successCount++
      } catch (err) { 
        console.error(`[Cron] 司機 ${d.name} 推播失敗:`, err) 
      }
    }
  }

  // ==========================================
  // 4. 處理群組推播
  // 條件：開啟提醒 (is_reminder_enabled) + 有群組 ID
  // ==========================================
  const { data: groups } = await supabase
    .from('line_groups')
    .select('id, name, line_group_id, last_reminder_date')
    .eq('is_reminder_enabled', true)
    .not('line_group_id', 'is', null)

  for (const g of (groups || [])) {
    // 只要今天還沒發過就發送
    if (g.last_reminder_date !== today) {
      try {
        // 替換前端設定可能包含的 {GroupName} 變數
        const finalGroupMsg = groupReminderMsg.replace(/{GroupName}/g, g.name || '此群組')
        await push(g.line_group_id, [textMessage(finalGroupMsg)])
        await supabase.from('line_groups').update({ last_reminder_date: today }).eq('id', g.id)
        successCount++
      } catch (err) { 
        console.error(`[Cron] 群組 ${g.name} 推播失敗:`, err) 
      }
    }
  }
  
  return NextResponse.json({ ok: true, sent: successCount, date: today })
}
