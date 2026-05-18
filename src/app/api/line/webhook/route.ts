import { headers } from 'next/headers'
import { verifyLineSignature } from '@/lib/line/signature'
import { findDriverByLineUserId, handleBindingInput, startBinding, MENU_HINT } from '@/lib/line/flows/bind'
import { handleFuel, handleFuelEntry } from '@/lib/line/flows/fuel'
import { startTrip } from '@/lib/line/flows/trip'
import { handleTripText, looksLikeTripText } from '@/lib/line/flows/tripText'
import { startMaintenance } from '@/lib/line/flows/maintenance'
import { loadSession, resetSession } from '@/lib/line/session'
import { reply, textMessage } from '@/lib/line/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LineMessage =
  | { type: 'text'; id: string; text: string }
  | { type: 'image'; id: string }
  | { type: 'video' | 'audio' | 'file' | 'location' | 'sticker'; id: string }

type LineEvent =
  | {
      type: 'message'
      replyToken: string
      source: { type: string; userId?: string }
      message: LineMessage
    }
  | {
      type: 'follow'
      replyToken: string
      source: { type: string; userId?: string }
    }
  | {
      type: 'unfollow'
      source: { type: string; userId?: string }
    }
  | { type: string; replyToken?: string; source?: { userId?: string } }

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text()
  const h = await headers()
  const signature = h.get('x-line-signature')

  if (!verifyLineSignature(rawBody, signature)) {
    console.error('[line.webhook] signature mismatch')
    return new Response('Unauthorized', { status: 401 })
  }

  let body: { events?: LineEvent[] }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const events = body.events ?? []
  await Promise.all(events.map(handleEvent))
  return new Response('OK', { status: 200 })
}

export async function GET(): Promise<Response> {
  return new Response('LINE webhook OK', { status: 200 })
}

async function handleEvent(event: LineEvent): Promise<void> {
  try {
    const userId = event.source?.userId
    if (!userId) return

    if (event.type === 'unfollow') {
      await resetSession(userId)
      return
    }

    const replyToken = (event as { replyToken?: string }).replyToken
    if (!replyToken) return

    if (event.type === 'follow') {
      const driver = await findDriverByLineUserId(userId)
      if (driver) {
        await reply(replyToken, [textMessage(`歡迎回來，${driver.name}。\n${MENU_HINT}`)])
        return
      }
      await startBinding(userId, replyToken)
      return
    }

    if (event.type !== 'message') return
    const msg = (event as Extract<LineEvent, { type: 'message' }>).message

    const driver = await findDriverByLineUserId(userId)
    const session = await loadSession(userId)

    // 未綁定 → 任何訊息都走綁定流程
    if (!driver) {
      if (session.state !== 'binding') {
        await startBinding(userId, replyToken)
        return
      }
      if (msg.type !== 'text') {
        await reply(replyToken, [textMessage('請以文字輸入：電話 姓名')])
        return
      }
      await handleBindingInput(userId, replyToken, msg.text)
      return
    }

    // 已綁定
    const text = msg.type === 'text' ? msg.text.trim() : null
    const imageId = msg.type === 'image' ? msg.id : null

    // 「加油」開頭一律當新指令（含逐步引導與快速回報），不論目前 session 狀態
    if (text && /^加油(\s|$)/.test(text)) {
      await handleFuelEntry(driver.id, userId, replyToken, text)
      return
    }

    // 「車趟」開頭：以 LIFF 表單回報
    if (text && /^車趟(\s|$)/.test(text)) {
      await startTrip(userId, replyToken)
      return
    }

    // 「維修」/「保養」開頭：以 LIFF 表單 + AI 辨識回報
    if (text && /^(維修|保養)(\s|$)/.test(text)) {
      await startMaintenance(userId, replyToken)
      return
    }

    // 純文字車趟回報（以日期開頭：N號 / 今天 / M月N日 / M/N）
    if (text && looksLikeTripText(text)) {
      await handleTripText(driver.id, driver.name, userId, replyToken, text)
      return
    }

    if (session.state === 'idle') {
      await reply(replyToken, [textMessage(MENU_HINT)])
      return
    }

    // 進行中：加油流程
    if (session.state.startsWith('fuel:')) {
      await handleFuel(session, replyToken, text, imageId)
      return
    }

    // 未知狀態 → 重置
    await resetSession(userId)
    await reply(replyToken, [textMessage(`流程已重置。\n${MENU_HINT}`)])
  } catch (err) {
    console.error('[line.webhook] handler error', err)
  }
}
