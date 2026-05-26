import { createServiceClient } from '@/lib/supabase/service'
import { reply, textMessage } from '@/lib/line/api'
import { resetSession, saveSession } from '@/lib/line/session'

export const MENU_HINT = '可用指令：\n• 加油回報：輸入「加油」開啟表單，或快速：加油 [里程] [付款] [金額]\n• 車趟回報：\n  - 表單：輸入「車趟」\n  - 快速：日期 + 車趟（例：2號 低鮮 冷鏈永和10）\n  - 休假：日期 休息（例：4號 休息）\n  - 管理員代填：開頭或結尾加上「指定司機：王小明」\n• 維修保養：輸入「維修」或「保養」開啟表單（可上傳單據，AI 自動辨識）\n• 查詢：\n  - 查詢車趟（預設本月，可加「上月」、「近7天」）\n  - 查詢油資（預設本月，可加「上月」、「近7天」）\n（隨時輸入「/回報」可再次顯示此說明）'

export async function findDriverByLineUserId(lineUserId: string): Promise<{ id: string; name: string } | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('drivers')
    .select('id, name')
    .eq('line_user_id', lineUserId)
    .maybeSingle()
  return data ?? null
}

export async function isAdminLineUser(lineUserId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('line_user_id', lineUserId)
    .maybeSingle()
  return !!data && (data.role === 'admin' || data.role === 'owner')
}

export async function findDriverByName(name: string): Promise<{ id: string; name: string } | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('drivers')
    .select('id, name, status')
    .eq('name', name)
    .eq('status', 'active')
    .maybeSingle()
  if (!data) return null
  return { id: data.id, name: data.name }
}

export async function startBinding(lineUserId: string, replyToken: string): Promise<void> {
  await saveSession({ line_user_id: lineUserId, state: 'binding', payload: {} })
  await reply(replyToken, [
    textMessage('您好，請輸入您的電話與姓名綁定帳號。\n格式：電話 姓名（中間空格）\n例：0912345678 王小明'),
  ])
}

function normalizePhone(s: string): string {
  return s.replace(/[\s-]/g, '')
}

export async function handleBindingInput(
  lineUserId: string,
  replyToken: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length < 2) {
    await reply(replyToken, [textMessage('格式錯誤，請輸入：電話 姓名\n例：0912345678 王小明')])
    return
  }
  const phone = normalizePhone(parts[0])
  const name  = parts.slice(1).join('')
  if (!/^09\d{8}$/.test(phone) && !/^0\d{8,9}$/.test(phone)) {
    await reply(replyToken, [textMessage('電話格式看起來不正確，請重新輸入：電話 姓名')])
    return
  }

  const supabase = createServiceClient()
  const { data: existing, error } = await supabase
    .from('drivers')
    .select('id, name, line_user_id')
    .eq('phone', phone)
    .maybeSingle()
  if (error) {
    console.error('[bind] lookup error', error)
    await reply(replyToken, [textMessage('系統忙線，請稍後再試。')])
    return
  }

  if (existing) {
    if (existing.line_user_id && existing.line_user_id !== lineUserId) {
      await reply(replyToken, [textMessage('此電話已綁定其他 LINE 帳號，請聯絡管理員處理。')])
      return
    }
    if (existing.name && existing.name !== name) {
      await reply(replyToken, [textMessage(`此電話的系統姓名與輸入不符（系統：${existing.name}）。請確認後重新輸入：電話 姓名`)])
      return
    }
    const { error: updErr } = await supabase
      .from('drivers')
      .update({ line_user_id: lineUserId })
      .eq('id', existing.id)
    if (updErr) {
      console.error('[bind] update error', updErr)
      await reply(replyToken, [textMessage('綁定失敗，請稍後再試。')])
      return
    }
    // Mirror onto user_profiles so dashboard / unbind UI stays in sync.
    await supabase
      .from('user_profiles')
      .update({ line_user_id: lineUserId })
      .eq('driver_id', existing.id)
    await resetSession(lineUserId)
    await reply(replyToken, [textMessage(`綁定成功，${existing.name} 您好。\n${MENU_HINT}`)])
    return
  }

  const { data: inserted, error: insErr } = await supabase
    .from('drivers')
    .insert({ name, phone, line_user_id: lineUserId, status: 'active' })
    .select('id')
    .single()
  if (insErr) {
    console.error('[bind] insert error', insErr)
    await reply(replyToken, [textMessage('建檔失敗，請稍後再試或聯絡管理員。')])
    return
  }
  // If a profile already exists for this driver_id (rare), keep it in sync too.
  if (inserted?.id) {
    await supabase
      .from('user_profiles')
      .update({ line_user_id: lineUserId })
      .eq('driver_id', inserted.id)
  }
  await resetSession(lineUserId)
  await reply(replyToken, [textMessage(`已為您建立資料，${name} 您好。\n其餘人事資料請管理員後台補齊。\n${MENU_HINT}`)])
}
