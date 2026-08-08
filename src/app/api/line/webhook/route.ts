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

// 新增的 Flow imports
import { startMisc } from '@/lib/line/flows/misc'
import { sendMainMenu } from '@/lib/line/flows/menu'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LineMessage =
  | { type: 'text'; id: string; text: string }
  | { type: 'image'; id: string }
  | { type: 'video' | 'audio' | 'file' | 'location' | 'sticker'; id: string }

// 🌟 擴充 LineEvent 型別，支援 join 事件與群組 ID，以及 postback (按鈕點擊)
type LineEvent =
  | {
      type: 'message'
      replyToken: string
      source: { type: string; userId?: string; groupId?: string; roomId?: string }
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
  | {
      type: 'join'
      replyToken: string
      source: { type: string; groupId?: string; roomId?: string }
    }
  | {
      type: 'postback'
      replyToken: string
      source: { type: string; userId?: string; groupId?: string; roomId?: string }
      postback: { data: string }
    }
  | { type: string; replyToken?: string; source?: { userId?: string; groupId?: string; roomId?: string } }

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

// 🌟 共用函式：註冊群組與發送自訂歡迎詞
async function registerGroupAndWelcome(groupId: string, defaultName: string, replyToken: string) {
  const supabase = createServiceClient();
  let groupName = defaultName;

  try {
    const res = await fetch(`https://api.line.me/v2/bot/group/${groupId}/summary`, {
      headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` }
    });
    if (res.ok) {
      const data = await res.json();
      groupName = data.groupName || groupName;
    }
  } catch (err) {
    console.error('[line.group] 無法取得群組名稱', err);
  }

  const { error } = await supabase.from('line_groups').upsert({
    line_group_id: groupId,
    name: groupName,
    reminder_enabled: true
  }, { onConflict: 'line_group_id' });

  if (error) {
    await reply(replyToken, [textMessage(`❌ 群組綁定失敗：${error.message}`)]);
    return;
  }

  const { data: setting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'group_welcome_msg')
    .single();

  const template = setting?.value || '🤖\n已成功綁定群組「{GroupName}」！\n系統每天將會在此群組發送報趟提醒喔！🚗';
  const finalMessage = template.replace(/{GroupName}/g, groupName);

  await reply(replyToken, [textMessage(finalMessage)]);
}

async function handleEvent(event: LineEvent): Promise<void> {
  try {
    const source = event.source as any;
    const userId = source?.userId;
    const replyToken = (event as { replyToken?: string }).replyToken;

    if (event.type === 'unfollow') {
      if (userId) await resetSession(userId)
      return
    }

    if (!replyToken) return

    // 🌟 1. 攔截「加入群組」事件 (join)
    if (event.type === 'join') {
      const groupId = source.groupId || source.roomId;
      if (groupId) {
        await registerGroupAndWelcome(groupId, '未命名群組', replyToken);
      }
      return;
    }

    if (event.type === 'follow') {
      const driver = await findDriverByLineUserId(userId)
      if (driver) {
        await reply(replyToken, [textMessage(`歡迎回來，${driver.name}。\n${MENU_HINT}`)])
        return
      }
      await startBinding(userId, replyToken)
      return
    }
    
    // 🌟 2. 攔截按鈕點擊 (Postback) 事件：例如「撤回車趟」
    if (event.type === 'postback') {
      const pbEvent = event as Extract<LineEvent, { type: 'postback' }>
      const data = pbEvent.postback.data
      
      // 解析傳遞過來的隱藏指令，例如：action=undo_trip&ids=uuid1,uuid2
      const params = new URLSearchParams(data)
      const action = params.get('action')
      const idsStr = params.get('ids')

      if (action === 'undo_trip' && idsStr) {
        const ids = idsStr.split(',')
        const supabase = createServiceClient()
        
        const { error } = await supabase
          .from('trips')
          .delete()
          .in('id', ids)

        if (error) {
          console.error('[line.webhook] Undo trip failed', error)
          await reply(replyToken, [textMessage(`❌ 撤回失敗，請稍後再試。(${error.message})`)])
        } else {
          await reply(replyToken, [textMessage('🗑️ 剛才回報的車趟已成功撤回，請重新報趟！')])
        }
        return
      }
    }

    if (event.type !== 'message') return
    const msg = (event as Extract<LineEvent, { type: 'message' }>).message
    const text = msg.type === 'text' ? msg.text.trim() : null
    const imageId = msg.type === 'image' ? msg.id : null

    // 🌟 3. 攔截群組手動綁定指令 (放在最前面，避免非司機成員被擋)
    if (text && text.startsWith('/綁定群組')) {
      const groupId = source.groupId || source.roomId;
      if (!groupId) {
        await reply(replyToken, [textMessage('❌ 此指令只能在 LINE 群組或多人聊天室中使用喔！')]);
        return;
      }
      const customName = text.replace('/綁定群組', '').trim() || '未命名群組';
      await registerGroupAndWelcome(groupId, customName, replyToken);
      return;
    }

    // 若非群組註冊指令，則必須要有 userId 才能進行後續操作
    if (!userId) return

    const driver = await findDriverByLineUserId(userId)
    const session = await loadSession(userId)
    
    const isGroup = source?.type === 'group' || source?.type === 'room'

    // 未綁定 → 處理邏輯
    if (!driver) {
      if (isGroup) {
        // 【防呆機制】：在群組中，未綁定的人發言，機器人直接「已讀不回」裝死
        // 除非他明確打出想綁定的指令，才引導他
        if (text && text.trim() === '/綁定') {
          await startBinding(userId, replyToken)
        }
        return 
      }

      // 如果是一對一私訊，就維持原本的強制引導綁定流程
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
    // 呼叫主選單：支援多種常見關鍵字 (群組內也可用)
    if (text && /^(選單|菜單|選項|按鈕|\/指令|\/回報|menu)$/i.test(text)) {
      await sendMainMenu(replyToken)
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

    // 🌟 攔截「下載車趟紀錄」指令 (支援指定司機與月份)
    const downloadMatch = text?.match(/^下載車趟紀錄\s+(\S+)\s+(\d{1,2})月?$/)
    if (downloadMatch) {
      const targetDriverName = downloadMatch[1]
      const targetMonth = parseInt(downloadMatch[2], 10)
      const currentYear = new Date().getFullYear()

      const supabase = createServiceClient()
      const { data: targetDriver } = await supabase
        .from('drivers')
        .select('id, name')
        .eq('name', targetDriverName)
        .single()

      if (!targetDriver) {
        await reply(replyToken, [textMessage(`❌ 找不到名為「${targetDriverName}」的司機。`)])
        return
      }

      // 建立下載 API 的專屬連結 (附帶參數)
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://yulang-erp.vercel.app'
      const downloadUrl = `${baseUrl}/api/export/driver-trips?driverId=${targetDriver.id}&month=${targetMonth}&year=${currentYear}`

      // 回傳下載卡片
      await reply(replyToken, [
        flexMessage('車趟紀錄下載', {
          type: 'bubble',
          size: 'kilo',
          body: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '20px',
            contents: [
              { type: 'text', text: '📊 專屬車趟報表已就緒', weight: 'bold', size: 'lg', color: '#2E7D32' },
              { type: 'text', text: `${targetDriver.name} - ${targetMonth}月份`, size: 'md', color: '#555555', margin: 'sm' },
              { type: 'text', text: '※ 報表已自動套用各廠商的計費週期', size: 'xs', color: '#888888', margin: 'md', wrap: true }
            ]
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                style: 'primary',
                color: '#2E7D32',
                action: { type: 'uri', label: '點我下載 EXCEL', uri: downloadUrl } as any
              }
            ]
          }
        })
      ])
      return
    }

    // 攔截進階的「車趟查詢」指令 (支援指定月份與司機)
    if (text && (text.startsWith('車趟查詢'))) {
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
// 進階車趟查詢邏輯 (採用 Flex Message 美化樣式)
// ============================================================================
async function handleAdvancedTripQuery(replyToken: string, text: string, defaultDriverId: string, defaultDriverName: string) {
  const supabase = createServiceClient()

  let targetMonthStr = ''
  let targetDriverName = ''

  // 1. 抓取日期 (例如 2026-07)
  const matchMonth = text.match(/(\d{4}-\d{2})/)
  if (matchMonth) targetMonthStr = matchMonth[1]

  // 去除指令本身，並排除日期格式的文字
  const cleanText = text.replace('車趟查詢', '').replace(targetMonthStr, '').trim()
  if (cleanText) {
    targetDriverName = cleanText
  }

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

  let targetDriverId = defaultDriverId
  let driverDisplayName = defaultDriverName

  // 如果有透過指令傳入名字，則進行查詢
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

  const flexBubble: any = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '📊 營運車趟統計', weight: 'bold', size: 'xl', color: '#ffffff' }
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
          type: 'box', layout: 'horizontal',
          contents: [
            { type: 'text', text: '司機', size: 'sm', color: '#8c8c8c', flex: 1 },
            { type: 'text', text: driverDisplayName, size: 'sm', color: '#111111', flex: 3, align: 'end', weight: 'bold' }
          ]
        },
        {
          type: 'box', layout: 'horizontal',
          contents: [
            { type: 'text', text: '月份', size: 'sm', color: '#8c8c8c', flex: 1 },
            { type: 'text', text: ymStr, size: 'sm', color: '#111111', flex: 3, align: 'end' }
          ]
        },
        { type: 'separator', margin: 'lg' },
        {
          type: 'box', layout: 'horizontal', margin: 'lg',
          contents: [
            { type: 'text', text: '完成趟次', size: 'md', color: '#555555', flex: 1, gravity: 'center' },
            { type: 'text', text: `${totalTrips} 趟`, size: 'lg', color: '#111111', flex: 2, align: 'end', weight: 'bold' }
          ]
        },
        {
          type: 'box', layout: 'horizontal', margin: 'md',
          contents: [
            { type: 'text', text: '預估運費', size: 'md', color: '#555555', flex: 1, gravity: 'center' },
            { type: 'text', text: `NT$ ${totalFare.toLocaleString()}`, size: 'xl', color: '#d32f2f', flex: 2, align: 'end', weight: 'bold' }
          ]
        }
      ]
    },
    footer: {
      type: 'box', layout: 'vertical', paddingTop: '0px',
      contents: [
        { type: 'text', text: '※ 實際金額依最終報表結算為準', size: 'xs', color: '#999999', align: 'center' }
      ]
    }
  }

  await reply(replyToken, [flexMessage(`【${driverDisplayName}】車趟查詢結果`, flexBubble)])
}
