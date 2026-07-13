import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { push, textMessage } from '@/lib/line/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // 1. 安全驗證：確保只有 Vercel Cron 能觸發這支 API
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createServiceClient()

  // 2. 撈出所有「在職」、「有綁定 LINE」且「開啟提醒」的司機
  const { data: drivers } = await supabase
    .from('drivers')
    .select('name, line_user_id')
    .eq('status', 'active')
    .eq('daily_reminder_enabled', true)
    .not('line_user_id', 'is', null)

  if (!drivers) return NextResponse.json({ count: 0 })

  // 3. 批次發送 LINE 推播訊息
  let successCount = 0
  for (const d of drivers) {
    try {
      await push(d.line_user_id, [
        textMessage(`晚安 ${d.name}！🌙\n溫馨提醒：如果您今天有出車，請記得回報今日的車趟紀錄喔！🚗`)
      ])
      successCount++
    } catch (err) {
      console.error(`推播給 ${d.name} 失敗`, err)
    }
  }

  return NextResponse.json({ ok: true, sent: successCount })
}
