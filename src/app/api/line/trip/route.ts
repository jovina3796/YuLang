import { createServiceClient } from '@/lib/supabase/service'
import { verifyAccessToken } from '@/lib/line/profile'
import { push, flexMessage } from '@/lib/line/api'
import { tripSuccessBubble } from '@/lib/line/flex'
import { calcFare } from '@/lib/fare'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/line/trip — used by the LIFF form to submit one trip.
// Auth: Authorization: Bearer <LIFF access token>
// Body: application/json
//   logged_at:        YYYY-MM-DD (required)
//   vendor_id:        uuid (required)
//   rate_rule_id:     uuid (required)
//   vehicle_id:       uuid (optional; auto-resolved)
//   trip_count:       number (required, >=1)
//   actual_stops:     number (optional)
//   is_kpi_achieved:  boolean (optional)
//   is_special:       boolean (optional)
//   destination_area: string (optional)
//   notes:            string (optional)
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

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 })
  }

  const loggedAt    = String(body.logged_at ?? '')
  const vendorId    = String(body.vendor_id ?? '')
  const rateRuleId  = String(body.rate_rule_id ?? '')
  const vehicleIdIn = body.vehicle_id ? String(body.vehicle_id) : ''
  const tripCount   = Number(body.trip_count ?? 0)
  const stopsRaw    = body.actual_stops
  const isKpi       = body.is_kpi_achieved == null ? null : Boolean(body.is_kpi_achieved)
  const isSpecial   = Boolean(body.is_special ?? false)
  const destArea    = (body.destination_area ? String(body.destination_area) : '').trim() || null
  const notes       = (body.notes ? String(body.notes) : '').trim() || null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(loggedAt) || isNaN(Date.parse(loggedAt))) {
    return Response.json({ error: 'invalid_date' }, { status: 400 })
  }
  if (!vendorId)   return Response.json({ error: 'vendor_required' }, { status: 400 })
  if (!rateRuleId) return Response.json({ error: 'rate_rule_required' }, { status: 400 })
  if (!Number.isFinite(tripCount) || tripCount < 1) {
    return Response.json({ error: 'invalid_trip_count' }, { status: 400 })
  }
  let actualStops: number | null = null
  if (stopsRaw != null && String(stopsRaw).trim() !== '') {
    const n = Number(stopsRaw)
    if (!Number.isFinite(n) || n < 0) return Response.json({ error: 'invalid_stops' }, { status: 400 })
    actualStops = Math.round(n)
  }

  const { data: rule } = await supabase
    .from('vendor_rate_rules')
    .select('id, vendor_id, pricing_mode, base_trips, base_fare, kpi_fare, base_stops, surcharge_per_stop, special_rate, destination_area, service_type')
    .eq('id', rateRuleId)
    .maybeSingle()
  if (!rule || rule.vendor_id !== vendorId) {
    return Response.json({ error: 'rate_rule_mismatch' }, { status: 400 })
  }

  const vehicleId = vehicleIdIn || null
  const isKpiBased = rule.pricing_mode === 'base_or_kpi'
  const isKpiFinal = isKpiBased ? (isKpi ?? true) : null
  const isSpecialFinal = rule.special_rate ? isSpecial : false

  const fare = calcFare(rule, Math.round(tripCount), actualStops ?? 0, isKpiFinal ?? false, isSpecialFinal)

  const { error: insErr } = await supabase.from('trips').insert({
    vendor_id:        vendorId,
    rate_rule_id:     rateRuleId,
    driver_id:        driver.id,
    vehicle_id:       vehicleId,
    destination_area: destArea,
    departed_at:      new Date(`${loggedAt}T00:00:00+08:00`).toISOString(),
    actual_stops:     actualStops,
    is_kpi_achieved:  isKpiFinal,
    is_special:       isSpecialFinal,
    calculated_fare:  fare,
    final_fare:       fare,
    trip_count:       Math.round(tripCount),
    notes,
    status:           'completed',
  })
  if (insErr) {
    console.error('[api.line.trip] insert failed', insErr)
    return Response.json({ error: 'insert_failed', detail: insErr.message }, { status: 500 })
  }

  const { data: vendor } = await supabase
    .from('vendors')
    .select('name, warehouse')
    .eq('id', vendorId)
    .maybeSingle()
  const vendorLabel = vendor
    ? `${vendor.name}${vendor.warehouse ? `／${vendor.warehouse}` : ''}`
    : ''

  await push(profile.userId, [
    flexMessage('車趟資料已記錄', tripSuccessBubble({
      date:       loggedAt,
      vendor:     vendorLabel,
      area:       (rule as { destination_area: string | null }).destination_area,
      service:    (rule as { service_type: string | null }).service_type,
      trip_count: Math.round(tripCount),
      stops:      actualStops,
      fare,
      is_kpi:     isKpiFinal,
      is_special: isSpecialFinal,
    })),
  ])

  return Response.json({ ok: true, fare })
}
