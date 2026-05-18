import { createServiceClient } from '@/lib/supabase/service'
import { verifyAccessToken } from '@/lib/line/profile'
import { push, flexMessage } from '@/lib/line/api'
import { maintenanceSuccessBubble } from '@/lib/line/flex'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'maintenance-receipts'

// POST /api/line/maintenance — submit one maintenance log.
// Auth: Authorization: Bearer <LIFF access token>
// Body: multipart/form-data
//   serviced_at:        YYYY-MM-DD (required)
//   vehicle_id:         uuid (required)
//   type:               string (required)
//   vendor_name:        string (optional)
//   cost:               number (optional)
//   mileage_at_service: number (optional)
//   next_due_date:      YYYY-MM-DD (optional)
//   notes:              string (optional)
//   receipt:            File (optional)
export async function POST(request: Request): Promise<Response> {
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const profile = await verifyAccessToken(token)
  if (!profile) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: driver } = await supabase
    .from('drivers')
    .select('id, name')
    .eq('line_user_id', profile.userId)
    .maybeSingle()
  if (!driver) return Response.json({ error: 'driver_not_bound' }, { status: 403 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 })
  }

  const servicedAt = String(form.get('serviced_at') ?? '')
  const vehicleId  = String(form.get('vehicle_id') ?? '')
  const type       = String(form.get('type') ?? '').trim()
  const vendorName = (String(form.get('vendor_name') ?? '').trim()) || null
  const costRaw    = String(form.get('cost') ?? '')
  const mileageRaw = String(form.get('mileage_at_service') ?? '')
  const nextDueRaw = String(form.get('next_due_date') ?? '').trim()
  const notes      = (String(form.get('notes') ?? '').trim()) || null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(servicedAt) || isNaN(Date.parse(servicedAt))) {
    return Response.json({ error: 'invalid_date' }, { status: 400 })
  }
  if (!vehicleId) return Response.json({ error: 'vehicle_required' }, { status: 400 })
  if (!type)      return Response.json({ error: 'type_required' }, { status: 400 })

  let cost: number | null = null
  if (costRaw.trim() !== '') {
    const n = Number(costRaw)
    if (!Number.isFinite(n) || n < 0) return Response.json({ error: 'invalid_cost' }, { status: 400 })
    cost = Math.round(n)
  }
  let mileage: number | null = null
  if (mileageRaw.trim() !== '') {
    const n = Number(mileageRaw)
    if (!Number.isFinite(n) || n < 0) return Response.json({ error: 'invalid_mileage' }, { status: 400 })
    mileage = Math.round(n)
  }
  let nextDue: string | null = null
  if (nextDueRaw !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueRaw) || isNaN(Date.parse(nextDueRaw))) {
      return Response.json({ error: 'invalid_next_due' }, { status: 400 })
    }
    nextDue = nextDueRaw
  }

  // Optional receipt upload
  let receiptUrl: string | null = null
  const receipt = form.get('receipt')
  if (receipt instanceof File && receipt.size > 0) {
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
      console.error('[api.line.maintenance] receipt upload failed', upErr)
      return Response.json({ error: 'receipt_upload_failed', detail: upErr.message }, { status: 500 })
    }
    receiptUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }

  const { error: insErr } = await supabase.from('maintenance_logs').insert({
    vehicle_id:         vehicleId,
    type,
    vendor_name:        vendorName,
    cost,
    mileage_at_service: mileage,
    serviced_at:        servicedAt,
    next_due_date:      nextDue,
    deduct_month:       null,
    notes,
    receipt_url:        receiptUrl,
  })
  if (insErr) {
    console.error('[api.line.maintenance] insert failed', insErr)
    return Response.json({ error: 'insert_failed', detail: insErr.message }, { status: 500 })
  }

  // Sync vehicle mileage upward if new reading is higher
  if (mileage != null) {
    const { data: v } = await supabase.from('vehicles').select('mileage').eq('id', vehicleId).single()
    if (mileage > (v?.mileage ?? 0)) {
      await supabase.from('vehicles').update({ mileage }).eq('id', vehicleId)
    }
  }

  const { data: vData } = await supabase.from('vehicles').select('plate_number').eq('id', vehicleId).single()

  await push(profile.userId, [
    flexMessage('維修保養已記錄', maintenanceSuccessBubble({
      date:     servicedAt,
      plate:    vData?.plate_number ?? '',
      type,
      vendor:   vendorName,
      cost,
      mileage,
      next_due: nextDue,
    })),
  ])

  return Response.json({ ok: true })
}
