import { createServiceClient } from '@/lib/supabase/service'
import { reply, getMessageContent, textMessage, type QuickReply } from '@/lib/line/api'
import { loadSession, resetSession, saveSession, type Session, type SessionPayload } from '@/lib/line/session'
import { MENU_HINT } from '@/lib/line/flows/bind'

const BUCKET = 'fuel-receipts'
const PAYMENTS = ['現金', '公司簽單', '信用卡']
const SKIP = '跳過'
const CANCEL = '取消'
const DONE = '完成'

function qrText(labels: string[]): QuickReply {
  return {
    items: labels.map(label => ({
      type: 'action',
      action: { type: 'message', label, text: label },
    })),
  }
}

export async function startFuel(lineUserId: string, replyToken: string): Promise<void> {
  await saveSession({ line_user_id: lineUserId, state: 'fuel:date_choice', payload: {} })
  await reply(replyToken, [
    textMessage('日期？', qrText(['今天', '補報日期', CANCEL])),
  ])
}

export async function handleFuel(
  session: Session,
  replyToken: string,
  text: string | null,
  imageMessageId: string | null,
): Promise<void> {
  const lineUserId = session.line_user_id

  if (text === CANCEL) {
    await resetSession(lineUserId)
    await reply(replyToken, [textMessage(`已取消。\n${MENU_HINT}`)])
    return
  }

  const payload: SessionPayload = { ...session.payload }

  switch (session.state) {
    case 'fuel:date_choice': {
      if (text === '今天') {
        payload.logged_at = new Date().toISOString()
        await askVehicle(lineUserId, replyToken, payload)
        return
      }
      if (text === '補報日期') {
        await saveSession({ line_user_id: lineUserId, state: 'fuel:date_input', payload })
        await reply(replyToken, [textMessage('請輸入日期，格式 YYYY-MM-DD\n例：2026-05-15', qrText([CANCEL]))])
        return
      }
      await reply(replyToken, [textMessage('請點選「今天」或「補報日期」。', qrText(['今天', '補報日期', CANCEL]))])
      return
    }

    case 'fuel:date_input': {
      const d = (text ?? '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d))) {
        await reply(replyToken, [textMessage('日期格式錯誤，請用 YYYY-MM-DD 重新輸入。', qrText([CANCEL]))])
        return
      }
      payload.logged_at = new Date(d).toISOString()
      await askVehicle(lineUserId, replyToken, payload)
      return
    }

    case 'fuel:vehicle': {
      const supabase = createServiceClient()
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('id, plate_number, status')
        .eq('status', 'active')
      const match = (vehicles ?? []).find(v => v.plate_number === (text ?? '').trim())
      if (!match) {
        await askVehicle(lineUserId, replyToken, payload)
        return
      }
      payload.vehicle_id = match.id
      await saveSession({ line_user_id: lineUserId, state: 'fuel:mileage', payload })
      await reply(replyToken, [textMessage('目前里程 (km)？無則回「跳過」', qrText([SKIP, CANCEL]))])
      return
    }

    case 'fuel:mileage': {
      if (text === SKIP) {
        payload.mileage_at_refuel = null
      } else {
        const n = Number((text ?? '').trim())
        if (!Number.isFinite(n) || n < 0) {
          await reply(replyToken, [textMessage('請輸入正整數里程，或點選「跳過」。', qrText([SKIP, CANCEL]))])
          return
        }
        payload.mileage_at_refuel = Math.round(n)
      }
      await saveSession({ line_user_id: lineUserId, state: 'fuel:total', payload })
      await reply(replyToken, [textMessage('金額 (NT$)？', qrText([CANCEL]))])
      return
    }

    case 'fuel:total': {
      const n = Number((text ?? '').trim())
      if (!Number.isFinite(n) || n <= 0) {
        await reply(replyToken, [textMessage('請輸入正確金額（數字，大於 0）。', qrText([CANCEL]))])
        return
      }
      payload.total_cost = Math.round(n)
      await saveSession({ line_user_id: lineUserId, state: 'fuel:payment', payload })
      await reply(replyToken, [textMessage('付款方式？', qrText([...PAYMENTS, SKIP, CANCEL]))])
      return
    }

    case 'fuel:payment': {
      const t = (text ?? '').trim()
      if (t === SKIP) payload.payment_method = null
      else if (PAYMENTS.includes(t)) payload.payment_method = t
      else {
        await reply(replyToken, [textMessage('請點選付款方式。', qrText([...PAYMENTS, SKIP, CANCEL]))])
        return
      }
      await saveSession({ line_user_id: lineUserId, state: 'fuel:notes', payload })
      await reply(replyToken, [textMessage('備註？無則回「跳過」', qrText([SKIP, CANCEL]))])
      return
    }

    case 'fuel:notes': {
      const t = (text ?? '').trim()
      payload.notes = t === SKIP || t === '' ? null : t
      await saveSession({ line_user_id: lineUserId, state: 'fuel:receipt', payload })
      await reply(replyToken, [textMessage('請傳收據照片，或回「完成」結束（無收據）。', qrText([DONE, CANCEL]))])
      return
    }

    case 'fuel:receipt': {
      if (imageMessageId) {
        const url = await uploadReceipt(imageMessageId)
        if (!url) {
          await reply(replyToken, [textMessage('收據上傳失敗，請再傳一次或回「完成」略過。', qrText([DONE, CANCEL]))])
          return
        }
        payload.receipt_url = url
        await finalize(session.line_user_id, replyToken, payload)
        return
      }
      if (text === DONE) {
        await finalize(session.line_user_id, replyToken, payload)
        return
      }
      await reply(replyToken, [textMessage('請傳一張收據照片，或回「完成」略過。', qrText([DONE, CANCEL]))])
      return
    }

    default:
      await resetSession(lineUserId)
      await reply(replyToken, [textMessage(`流程已重置。\n${MENU_HINT}`)])
  }
}

async function askVehicle(lineUserId: string, replyToken: string, payload: SessionPayload): Promise<void> {
  const supabase = createServiceClient()
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, plate_number')
    .eq('status', 'active')
    .order('plate_number')
  const plates = (vehicles ?? []).map(v => v.plate_number).filter(Boolean) as string[]
  if (plates.length === 0) {
    await resetSession(lineUserId)
    await reply(replyToken, [textMessage('系統內無啟用車輛，請聯絡管理員。')])
    return
  }
  await saveSession({ line_user_id: lineUserId, state: 'fuel:vehicle', payload })
  // LINE Quick Reply 上限 13 個，超過就提示用打字
  const labels = plates.slice(0, 12)
  const hint = plates.length > 12 ? '（車輛較多，未列出者請直接輸入車牌）' : ''
  await reply(replyToken, [textMessage(`請選擇車輛${hint}`, qrText([...labels, CANCEL]))])
}

async function uploadReceipt(messageId: string): Promise<string | null> {
  const content = await getMessageContent(messageId)
  if (!content) return null
  const supabase = createServiceClient()
  const ext =
    content.contentType.includes('jpeg') ? 'jpg' :
    content.contentType.includes('png')  ? 'png' :
    content.contentType.includes('pdf')  ? 'pdf' : 'bin'
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${Date.now()}-${rand}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(
    path,
    new Uint8Array(content.buffer),
    { contentType: content.contentType, upsert: false },
  )
  if (error) {
    console.error('[fuel] receipt upload failed', error)
    return null
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

async function finalize(lineUserId: string, replyToken: string, payload: SessionPayload): Promise<void> {
  if (!payload.vehicle_id || payload.total_cost == null || !payload.logged_at) {
    await resetSession(lineUserId)
    await reply(replyToken, [textMessage('資料不完整，已取消，請重新開始。')])
    return
  }

  const supabase = createServiceClient()
  const { data: driver } = await supabase
    .from('drivers')
    .select('id')
    .eq('line_user_id', lineUserId)
    .maybeSingle()

  const { error } = await supabase.from('fuel_logs').insert({
    vehicle_id:        payload.vehicle_id,
    driver_id:         driver?.id ?? null,
    liters:            null,
    price_per_liter:   null,
    total_cost:        payload.total_cost,
    mileage_at_refuel: payload.mileage_at_refuel ?? null,
    station_name:      null,
    payment_method:    payload.payment_method ?? null,
    notes:             payload.notes ?? null,
    logged_at:         payload.logged_at,
    receipt_url:       payload.receipt_url ?? null,
  })
  if (error) {
    console.error('[fuel] insert failed', error)
    await reply(replyToken, [textMessage(`寫入失敗：${error.message}`)])
    return
  }

  if (payload.mileage_at_refuel != null) {
    const { data: v } = await supabase
      .from('vehicles')
      .select('mileage, plate_number')
      .eq('id', payload.vehicle_id)
      .single()
    const current = v?.mileage ?? 0
    if (payload.mileage_at_refuel > current) {
      await supabase.from('vehicles').update({ mileage: payload.mileage_at_refuel }).eq('id', payload.vehicle_id)
    }
  }

  const { data: v } = await supabase
    .from('vehicles')
    .select('plate_number')
    .eq('id', payload.vehicle_id)
    .single()
  const date = payload.logged_at.slice(0, 10)
  const summary =
    `加油已記錄 ✓\n` +
    `日期：${date}\n` +
    `車輛：${v?.plate_number ?? ''}\n` +
    `金額：NT$ ${payload.total_cost}\n` +
    (payload.mileage_at_refuel != null ? `里程：${payload.mileage_at_refuel} km\n` : '') +
    (payload.payment_method ? `付款：${payload.payment_method}\n` : '') +
    (payload.receipt_url ? '收據：已上傳\n' : '')

  await resetSession(lineUserId)
  await reply(replyToken, [textMessage(`${summary}\n${MENU_HINT}`)])
}
