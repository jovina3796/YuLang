import { reply, textMessage, flexMessage } from '@/lib/line/api'
import { resetSession } from '@/lib/line/session'
import { tripFormTriggerBubble } from '@/lib/line/flex'

export async function startTrip(lineUserId: string, replyToken: string): Promise<void> {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID
  await resetSession(lineUserId)
  if (!liffId) {
    await reply(replyToken, [textMessage('車趟回報需 LIFF 表單，請聯絡管理員設定 NEXT_PUBLIC_LIFF_ID。')])
    return
  }
  const tripLiffId = process.env.NEXT_PUBLIC_LIFF_ID_TRIP || liffId
  const url = `https://liff.line.me/${tripLiffId}`
  await reply(replyToken, [flexMessage('車趟回報', tripFormTriggerBubble(url))])
}
