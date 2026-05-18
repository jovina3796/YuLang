import { createServiceClient } from '@/lib/supabase/service'
import { verifyAccessToken } from '@/lib/line/profile'
import { resolveVehicleForDriver } from '@/lib/line/vehicleResolve'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/line/trip/config — used by the LIFF trip form to populate selects.
// Auth: Authorization: Bearer <LIFF access token>
export async function GET(request: Request): Promise<Response> {
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

  const [{ data: vehicles }, { data: vendors }, { data: rateRules }, { data: aliases }] = await Promise.all([
    supabase.from('vehicles').select('id, plate_number').eq('status', 'active').order('plate_number'),
    supabase.from('vendors')
      .select('id, name, warehouse')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('name'),
    supabase.from('vendor_rate_rules')
      .select('id, vendor_id, service_type, destination_area, base_trips, base_fare, kpi_fare, base_stops, surcharge_per_stop, pricing_mode, special_rate, special_rate_note, is_service_default, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('service_type'),
    supabase.from('subroute_aliases').select('alias, billing_area').order('alias'),
  ])

  const resolvedVehicleId = await resolveVehicleForDriver(driver.id)

  return Response.json({
    driver:    { id: driver.id, name: driver.name },
    vehicles:  vehicles  ?? [],
    vendors:   vendors   ?? [],
    rateRules: rateRules ?? [],
    aliases:   aliases   ?? [],
    resolvedVehicleId,
  })
}
