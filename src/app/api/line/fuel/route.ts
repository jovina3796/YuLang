import { createServiceClient } from '@/lib/supabase/service'
import { verifyAccessToken } from '@/lib/line/profile'
import { resolvePaymentMethod } from '@/lib/line/aliasMatch'
import { push, flexMessage } from '@/lib/line/api'
import { fuelSuccessBubble } from '@/lib/line/flex'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'fuel-receipts'

// POST /api/line/fuel — used by the LIFF form to submit one fuel log.
// Auth: Authorization: Bearer <LIFF access token>
// Body: multipart/form-data
//   logged_at:        YYYY-MM-DD (required)
//   vehicle_id:       uuid (required)
//   total_cost:       number (required, > 0)
//   mileage_at_refuel: number (optional)
//   payment_method:   string (optional, alias keyword OK)
//   notes:            string (optional)
//   receipt:          File (optional)
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

  const loggedAt = String(form.get('logged_at') ?? '')
  const vehicleId = String(form.get('vehicle_id') ?? '')
  const totalRaw  = String(form.get('total_cost') ?? '')
  const mileageRaw = String(form.get('mileage_at_refuel') ?? '')
  const paymentRaw = String(form.get('payment_method') ?? '')
  const notes = String(form.get('notes') ?? '').trim() || null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(loggedAt) || isNaN(Date.parse(loggedAt))) {
    return Response.json({ error: 'invalid_date' }, { status: 400 })
  }
  if (!vehicleId) {
    return Response.json({ error: 'vehicle_required' }, { status: 400 })
  }
  const total = Number(totalRaw)
  if (!Number.isFinite(total) || total <= 0) {
    return Response.json({ error: 'invalid_total' }, { status: 400 })
  }
  let mileage: number | null = null
  if (mileageRaw.trim() !== '') {
    const m = Number(mileageRaw)
    if (!Number.isFinite(m) || m < 0) return Response.json({ error: 'invalid_mileage' }, { status: 400 })
    mileage = Math.round(m)
  }

  // payment: try alias first, fallback to raw text
  let payment: string | null = null
  const paymentTrimmed = paymentRaw.trim()
  if (paymentTrimmed) {
    payment = (await resolvePaymentMethod(paymentTrimmed)) ?? paymentTrimmed
  }

  // Receipt (optional)
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
      console.error('[api.line.fuel] receipt upload failed', upErr)
      return Response.json({ error: 'receipt_upload_failed', detail: upErr.message }, { status: 500 })
    }
    receiptUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }

  const { error: insErr } = await supabase.from('fuel_logs').insert({
    vehicle_id:        vehicleId,
    driver_id:         driver.id,
    liters:            null,
    price_per_liter:   null,
    total_cost:        Math.round(total),
    mileage_at_refuel: mileage,
    station_name:      null,
    payment_method:    payment,
    notes,
    logged_at:         new Date(loggedAt).toISOString(),
    receipt_url:       receiptUrl,
  })
  if (insErr) {
    console.error('[api.line.fuel] insert failed', insErr)
    return Response.json({ error: 'insert_failed', detail: insErr.message }, { status: 500 })
  }

  if (mileage != null) {
    const { data: v } = await supabase.from('vehicles').select('mileage').eq('id', vehicleId).single()
    if (mileage > (v?.mileage ?? 0)) {
      await supabase.from('vehicles').update({ mileage }).eq('id', vehicleId)
    }
  }

  // Push a card-style ack back into the LINE chat.
  await push(profile.userId, [
    flexMessage('加油資料已記錄', fuelSuccessBubble({
      date:    loggedAt,
      plate:   '',
      mileage,
      total:   Math.round(total),
      payment: payment ?? null,
    })),
  ])

  return Response.json({ ok: true })
}
