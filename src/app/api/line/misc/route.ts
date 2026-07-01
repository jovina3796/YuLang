import { createServiceClient } from '@/lib/supabase/service'
import { verifyAccessToken } from '@/lib/line/profile'
import { push, textMessage } from '@/lib/line/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'misc-receipts' // 確保這個 Bucket 名稱與你 ERP 的一致

export async function POST(request: Request): Promise<Response> {
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const profile = await verifyAccessToken(token)
  if (!profile) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: driver } = await supabase
    .from('drivers')
    .select('id')
    .eq('line_user_id', profile.userId)
    .maybeSingle()
  if (!driver) return Response.json({ error: 'driver_not_bound' }, { status: 403 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 })
  }

  const transactionDate = String(form.get('transaction_date') ?? '')
  const type = String(form.get('type') ?? 'expense') 
  const amountRaw = String(form.get('amount') ?? '')
  const category = String(form.get('category') ?? '').trim() || null
  const description = String(form.get('description') ?? '').trim() || null
  const vehicleId = String(form.get('vehicle_id') ?? '').trim() || null
  const notes = String(form.get('notes') ?? '').trim() || null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
    return Response.json({ error: 'invalid_date' }, { status: 400 })
  }
  
  const amount = Number(amountRaw)
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: 'invalid_amount' }, { status: 400 })
  }

  let receiptUrl: string | null = null
  const receipt = form.get('receipt')
  if (receipt && receipt instanceof File && receipt.size > 0) {
    const ext = (receipt.type.includes('jpeg') ? 'jpg'
              : receipt.type.includes('png')  ? 'png'
              : receipt.type.includes('pdf')  ? 'pdf'
              : (receipt.name.split('.').pop() || 'bin').toLowerCase())
    const rand = Math.random().toString(36).slice(2, 8)
    const path = `${Date.now()}-${rand}.${ext}`
    
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(
      path,
      receipt,
      { contentType: receipt.type || undefined, upsert: false },
    )
    if (upErr) {
      console.error('[api.line.misc] receipt upload failed', upErr)
      return Response.json({ error: 'receipt_upload_failed', detail: upErr.message }, { status: 500 })
    }
    receiptUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }

  const { error: insErr } = await supabase.from('misc_transactions').insert({
    type,
    amount: Math.round(amount),
    category,
    description,
    transaction_date: transactionDate,
    driver_id: driver.id,
    vehicle_id: vehicleId,
    notes,
    receipt_url: receiptUrl,
    payment_status: 'paid' // 預設司機墊付或現金支出為已支付
  })

  if (insErr) {
    console.error('[api.line.misc] insert failed', insErr)
    return Response.json({ error: 'insert_failed', detail: insErr.message }, { status: 500 })
  }

  // 成功後推播確認訊息給司機
  const typeLabel = type === 'income' ? '收入' : '支出'
  await push(profile.userId, [
    textMessage(`✅ 其他${typeLabel}已記錄\n日期：${transactionDate}\n類別：${category || '無'}\n金額：NT$ ${amount}\n\n已成功同步至 ERP 系統。`)
  ])

  return Response.json({ ok: true })
}
