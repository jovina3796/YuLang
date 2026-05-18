import { reply, textMessage, flexMessage } from '@/lib/line/api'
import { resetSession } from '@/lib/line/session'
import { maintenanceFormTriggerBubble } from '@/lib/line/flex'

export async function startMaintenance(lineUserId: string, replyToken: string): Promise<void> {
  await resetSession(lineUserId)
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID_MAINTENANCE
              || process.env.NEXT_PUBLIC_LIFF_ID
  if (!liffId) {
    await reply(replyToken, [textMessage('維修保養回報需 LIFF 表單，請聯絡管理員設定 NEXT_PUBLIC_LIFF_ID_MAINTENANCE。')])
    return
  }
  const url = `https://liff.line.me/${liffId}`
  await reply(replyToken, [flexMessage('維修保養回報', maintenanceFormTriggerBubble(url))])
}
