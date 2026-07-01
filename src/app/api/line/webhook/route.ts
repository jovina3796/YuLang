import { headers } from 'next/headers'
import { verifyLineSignature } from '@/lib/line/signature'
import { findDriverByLineUserId, handleBindingInput, startBinding, MENU_HINT } from '@/lib/line/flows/bind'
import { handleFuel, handleFuelEntry } from '@/lib/line/flows/fuel'
import { startTrip } from '@/lib/line/flows/trip'
import { handleTripText, looksLikeTripText } from '@/lib/line/flows/tripText'
import { handleQueryMenu, handleTripQuery, handleFuelQuery, detectQueryKind } from '@/lib/line/flows/query'
import { startMaintenance } from '@/lib/line/flows/maintenance'
import { loadSession, resetSession } from '@/lib/line/session'
import { reply, textMessage, flexMessage } from '@/lib/line/api' 
import { createServiceClient } from '@/lib/supabase/service'
import { startMisc } from '@/lib/line/flows/misc'

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

    // 「/指令」：顯示所有可用指令（顯式請求才提示）
    if (text === '/指令' || text === '/回報') {
      await reply(replyToken, [textMessage(MENU_HINT)])
      return
    }

    // 「加油」開頭一律當新指令
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

    // 「報帳」開頭，彈出其他收支 LIFF 表單
    if (text && /^報帳(\s|$)/.test(text)) {
      await startMisc(userId, replyToken)
        return
    }

    // 攔截進階的「車趟查詢」指令 (支援指定月份與司機)
    if (text && (text.startsWith('車趟查詢') || text.startsWith('查詢車趟'))) {
      await handleAdvancedTripQuery(replyToken, text, driver.id, driver.name)
      return
    }

    // 原有的查詢邏輯 fallback
    if (text) {
      const qKind = detectQueryKind(text)
      if (qKind === 'menu') {
        await handleQueryMenu(replyToken)
        return
      }
      if (qKind === 'trip') {
        await handleTripQuery(driver.id, driver.name, userId, replyToken, text)
        return
      }
      if (qKind === 'fuel') {
        await handleFuelQuery(driver.id, driver.name, userId, replyToken, text)
        return
      }
    }

    // 純文字車趟回報
    if (text && looksLikeTripText(text)) {
      await handleTripText(driver.id, driver.name, userId, replyToken, text)
      return
    }

    // 進行中：加油流程
    if (session.state.startsWith('fuel:')) {
      await handleFuel(session, replyToken, text, imageId)
      return
    }

    // idle 或無法辨識的狀態：保持沉默
    if (session.state !== 'idle') {
      await resetSession(userId)
    }
  } catch (err) {
    console.error('[line.webhook] handler error', err)
  }
}

// ============================================================================
// 進階車趟查詢邏輯 (採用 Flex Message 美化樣式 - 修正 TS 型別)
// ============================================================================
async function handleAdvancedTripQuery(replyToken: string, text: string, defaultDriverId: string, defaultDriverName: string) {
  const supabase = createServiceClient()

  let targetMonthStr = ''
  let targetDriverName = ''

  // 解析指令
  const matchMonth = text.match(/(\d{4}-\d{2})/)
  if (matchMonth) targetMonthStr = matchMonth[1]

  const matchDriver = text.match(/指定司機\s*(\S+)/)
  if (matchDriver) targetDriverName = matchDriver[1]

  // 計算時間邊界
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth()

  if (targetMonthStr) {
    const parts = targetMonthStr.split('-')
    year = parseInt(parts[0], 10)
    month = parseInt(parts[1], 10) - 1
  }

  const ymStr = `${year}-${String(month + 1).padStart(2, '0')}`
  const tpeMidnight = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d) - 8 * 3600 * 1000)
  const monthStart = tpeMidnight(year, month, 1).toISOString()
  const monthEnd   = tpeMidnight(year, month + 1, 1).toISOString()

  // 決定目標司機
  let targetDriverId = defaultDriverId
  let driverDisplayName = defaultDriverName

  if (targetDriverName) {
    const { data: d, error } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('name', targetDriverName)
      .single()

    if (error || !d) {
      await reply(replyToken, [textMessage(`❌ 系統中找不到名為「${targetDriverName}」的司機。`)])
      return
    }
    targetDriverId = d.id
    driverDisplayName = d.name
  }

  // 撈取資料
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('final_fare')
    .eq('driver_id', targetDriverId)
    .eq('status', 'completed')
    .gte('departed_at', monthStart)
    .lt('departed_at', monthEnd)

  if (tripsError) {
    console.error('Advanced Query Error:', tripsError)
    await reply(replyToken, [textMessage('❌ 系統查詢車趟時發生錯誤，請稍後再試。')])
    return
  }

  const totalTrips = trips?.length || 0
  const totalFare = trips?.reduce((sum, t) => sum + Number(t.final_fare || 0), 0) || 0

  // 🌟 建立 Flex Message Bubble JSON 結構 (加上 : any 繞過 TS 嚴格字串推論)
  const flexBubble: any = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '📊 營運車趟統計',
          weight: 'bold',
          size: 'xl',
          color: '#ffffff'
        }
      ],
      backgroundColor: '#2E7D32',
      paddingAll: '16px'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '20px',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '司機', size: 'sm', color: '#8c8c8c', flex: 1 },
            { type: 'text', text: driverDisplayName, size: 'sm', color: '#111111', flex: 3, align: 'end', weight: 'bold' }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '月份', size: 'sm', color: '#8c8c8c', flex: 1 },
            { type: 'text', text: ymStr, size: 'sm', color: '#111111', flex: 3, align: 'end' }
          ]
        },
        {
          type: 'separator',
          margin: 'lg'
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'lg',
          contents: [
            { type: 'text', text: '完成趟次', size: 'md', color: '#555555', flex: 1, gravity: 'center' },
            { type: 'text', text: `${totalTrips} 趟`, size: 'lg', color: '#111111', flex: 2, align: 'end', weight: 'bold' }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            { type: 'text', text: '預估運費', size: 'md', color: '#555555', flex: 1, gravity: 'center' },
            { type: 'text', text: `NT$ ${totalFare.toLocaleString()}`, size: 'xl', color: '#d32f2f', flex: 2, align: 'end', weight: 'bold' }
          ]
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingTop: '0px',
      contents: [
        {
          type: 'text',
          text: '※ 實際金額依最終報表結算為準',
          size: 'xs',
          color: '#999999',
          align: 'center'
        }
      ]
    }
  }

  // 使用 flexMessage 回傳
  await reply(replyToken, [flexMessage(`【${driverDisplayName}】車趟查詢結果`, flexBubble)])
}
