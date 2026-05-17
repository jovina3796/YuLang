import { createServiceClient } from '@/lib/supabase/service'
import { verifyAccessToken } from '@/lib/line/profile'
import { resolveVehicleForDriver } from '@/lib/line/vehicleResolve'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/line/fuel/config — used by the LIFF form to populate selects.
// Auth: Authorization: Bearer <LIFF access token>
export async function GET(request: Request): Promise<Response> {
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const profile = await verifyAccessToken(token)
  if (!profile) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: driver } = await supabase
    .from('drivers')
    .select('id, name, default_vehicle_id')
    .eq('line_user_id', profile.userId)
    .maybeSingle()
  if (!driver) return Response.json({ error: 'driver_not_bound' }, { status: 403 })

  const [{ data: vehicles }, { data: aliases }] = await Promise.all([
    supabase.from('vehicles').select('id, plate_number').eq('status', 'active').order('plate_number'),
    supabase.from('payment_aliases').select('target'),
  ])

  const resolvedVehicleId = await resolveVehicleForDriver(driver.id)
  const paymentSuggestions = Array.from(new Set([
    '現金', '公司簽帳', '信用卡',
    ...(aliases ?? []).map(a => a.target).filter(Boolean),
  ]))

  return Response.json({
    driver:   { id: driver.id, name: driver.name },
    vehicles: vehicles ?? [],
    resolvedVehicleId,
    paymentSuggestions,
  })
}
