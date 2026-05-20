import { createServiceClient } from '@/lib/supabase/service'
import { reply, getMessageContent, textMessage, flexMessage, type QuickReply } from '@/lib/line/api'
import { loadSession, resetSession, saveSession, type Session, type SessionPayload } from '@/lib/line/session'
import { MENU_HINT } from '@/lib/line/flows/bind'
import { resolvePaymentMethod } from '@/lib/line/aliasMatch'
import { resolveVehicleForDriver } from '@/lib/line/vehicleResolve'
import { fuelSuccessBubble, fuelFormTriggerBubble } from '@/lib/line/flex'

const BUCKET = 'fuel-receipts'
const PAYMENTS_FALLBACK = ['現金', '公司簽帳', '信用卡','其他']
const SKIP = '跳過'
const CANCEL = '取消'
const DONE = '完成'

const QUICK_HINT =
  '加油快速回報格式：\n' +
  '加油 [里程] [付款] [金額] [日期(選填)]\n' +
  '或輸入「加油」開啟表單。'

function qrText(labels: string[]): QuickReply {
  return {
    items: labels.map(label => ({
      type: 'action',
      action: { type: 'message', label, text: label },
    })),
  }
}

function isNumericToken(s: string): boolean {
  return /^\d+(\.\d+)?$/.test(s.trim())
}

export async function startFuel(lineUserId: string, replyToken: string): Promise<void> {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID
  if (liffId) {
    // No session needed — LIFF form submits directly via REST.
    await resetSession(lineUserId)
    await reply(replyToken, [
      flexMessage('加油回報', fuelFormTriggerBubble(`https://liff.line.me/${liffId}`)),
    ])
    return
  }
  // Fallback: stepwise text flow if LIFF not configured
  await saveSession({ line_user_id: lineUserId, state: 'fuel:date_choice', payload: {} })
  await reply(replyToken, [
    textMessage('日期？', qrText(['今天', '補報日期', CANCEL])),
  ])
}

// Decides between quick one-shot and stepwise flow based on token count.
// Quick format: "加油 [里程] [付款] [金額] [日期(選填)]"  (3 or 4 tokens after 加油)
export async function handleFuelEntry(driverId: string, lineUserId: string, replyToken: string, text: string): Promise<void> {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 1) {
    await startFuel(lineUserId, replyToken)
    return
  }
  if (tokens.length !== 4 && tokens.length !== 5) {
    await reply(replyToken, [textMessage(`格式錯誤。\n${QUICK_HINT}`)])
    return
  }

  const [, mileageStr, paymentStr, totalStr, dateStr] = tokens
  if (!isNumericToken(mileageStr) || !isNumericToken(totalStr)) {
    await reply(replyToken, [textMessage(`里程與金額需為數字。\n${QUICK_HINT}`)])
    return
  }
  const mileage = Math.round(Number(mileageStr))
  const total   = Math.round(Number(totalStr))
  if (total <= 0 || mileage < 0) {
    await reply(replyToken, [textMessage(`里程須 >= 0、金額須 > 0。\n${QUICK_HINT}`)])
    return
  }

  let loggedAtIso = new Date().toISOString()
  if (dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || isNaN(Date.parse(dateStr))) {
      await reply(replyToken, [textMessage(`日期格式錯誤（需 YYYY-MM-DD）。\n${QUICK_HINT}`)])
      return
    }
    loggedAtIso = new Date(dateStr).toISOString()
  }

  let payment = await resolvePaymentMethod(paymentStr)
  if (!payment && PAYMENTS_FALLBACK.includes(paymentStr.trim())) {
    payment = paymentStr.trim()
  }
  if (!payment) {
    await reply(replyToken, [textMessage(`無法辨識付款方式「${paymentStr}」。請到後台「付款別名」維護，或改用「現金 / 公司簽帳 / 信用卡」。\n${QUICK_HINT}`)])
    return
  }

  const vehicleId = await resolveVehicleForDriver(driverId)
  if (!vehicleId) {
    await reply(replyToken, [textMessage('找不到您今日的派車或預設車輛，請聯絡管理員設定「預設車輛」後再回報。')])
    return
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('fuel_logs').insert({
    vehicle_id:        vehicleId,
    driver_id:         driverId,
    liters:            null,
    price_per_liter:   null,
    total_cost:        total,
    mileage_at_refuel: mileage,
    station_name:      null,
    payment_method:    payment,
    notes:             null,
    logged_at:         loggedAtIso,
    receipt_url:       null,
  })
  if (error) {
    console.error('[fuel.quick] insert failed', error)
    await reply(replyToken, [textMessage(`寫入失敗：${error.message}`)])
    return
  }

  const { data: v } = await supabase
    .from('vehicles')
    .select('plate_number, mileage')
    .eq('id', vehicleId)
    .single()
  if (v && mileage > (v.mileage ?? 0)) {
    await supabase.from('vehicles').update({ mileage }).eq('id', vehicleId)
  }

  await resetSession(lineUserId)
  await reply(replyToken, [
    flexMessage('加油資料已記錄', fuelSuccessBubble({
      date:    new Date(loggedAtIso).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }),
      plate:   v?.plate_number ?? '',
      mileage,
      total,
      payment,
    }, { detailed: true })),
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
      payload.logged_at = new Date(`${d}T00:00:00+08:00`).toISOString()
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
      await reply(replyToken, [textMessage('付款方式？', qrText([...PAYMENTS_FALLBACK, SKIP, CANCEL]))])
      return
    }

    case 'fuel:payment': {
      const t = (text ?? '').trim()
      if (t === SKIP) payload.payment_method = null
      else if (PAYMENTS_FALLBACK.includes(t)) payload.payment_method = t
      else {
        // Try alias lookup before giving up
        const matched = await resolvePaymentMethod(t)
        if (matched) {
          payload.payment_method = matched
        } else {
          await reply(replyToken, [textMessage('請點選付款方式，或輸入別名（後台「付款別名」可維護）。', qrText([...PAYMENTS_FALLBACK, SKIP, CANCEL]))])
          return
        }
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

  await resetSession(lineUserId)
  await reply(replyToken, [
    flexMessage('加油資料已記錄', fuelSuccessBubble({
      date:    new Date(payload.logged_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }),
      plate:   '',
      mileage: payload.mileage_at_refuel ?? null,
      total:   payload.total_cost,
      payment: payload.payment_method ?? null,
    })),
  ])
}
