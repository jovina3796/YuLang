import { createServiceClient } from '@/lib/supabase/service'
import { verifyAccessToken } from '@/lib/line/profile'
import { resolveVehicleForDriver } from '@/lib/line/vehicleResolve'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/line/maintenance/config — used by the LIFF maintenance form.
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

  const [{ data: vehicles }, { data: pastLogs }] = await Promise.all([
    supabase.from('vehicles')
      .select('id, plate_number, mileage')
      .eq('status', 'active')
      .order('plate_number'),
    supabase.from('maintenance_logs')
      .select('vendor_name')
      .not('vendor_name', 'is', null)
      .order('serviced_at', { ascending: false })
      .limit(200),
  ])

  const vendorSuggestions = Array.from(new Set(
    (pastLogs ?? []).map(r => r.vendor_name).filter((s): s is string => !!s)
  )).slice(0, 30)

  const resolvedVehicleId = await resolveVehicleForDriver(driver.id)

  return Response.json({
    driver:   { id: driver.id, name: driver.name },
    vehicles: vehicles ?? [],
    vendorSuggestions,
    resolvedVehicleId,
  })
}
