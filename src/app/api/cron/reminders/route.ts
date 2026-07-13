import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { push, textMessage } from '@/lib/line/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // 安全驗證：確保只有 Vercel Cron 能觸發
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()
  let successCount = 0

  // ==========================================
  // 1. 發送私訊給個別司機
  // ==========================================
  const { data: drivers } = await supabase
    .from('drivers')
    .select('name, line_user_id')
    .eq('status', 'active')
    .eq('daily_reminder_enabled', true) // 🌟 只找有開提醒的
    .not('line_user_id', 'is', null)

  for (const d of (drivers || [])) {
    try {
      await push(d.line_user_id, [
        textMessage(`晚安 ${d.name}！🌙\n溫馨提醒：如果您今天有出車，請記得回報今日的車趟紀錄喔！🚗`)
      ])
      successCount++
    } catch (err) {
      console.error(`私訊推播給 ${d.name} 失敗`, err)
    }
  }

  // ==========================================
  // 2. 發送廣播給 LINE 群組
  // ==========================================
  const { data: groups } = await supabase
    .from('line_groups')
    .select('name, line_group_id')
    .eq('reminder_enabled', true) // 🌟 只找有開提醒的群組

  for (const g of (groups || [])) {
    try {
      await push(g.line_group_id, [
        textMessage(`大家晚安！🌙\n溫馨提醒：今天有出車的夥伴，請記得在系統回報車趟紀錄喔！🚗`)
      ])
      successCount++
    } catch (err) {
      console.error(`群組推播給 ${g.name} 失敗`, err)
    }
  }

  return NextResponse.json({ ok: true, sent: successCount })
}
