import { createServiceClient } from '@/lib/supabase/service'

// Resolve which vehicle a driver is using "right now" for the LINE quick fuel
// report. Priority:
//   1. today's schedules row vehicle_id, if present
//   2. drivers.default_vehicle_id fallback
// Returns null when neither resolves.
export async function resolveVehicleForDriver(driverId: string, date: Date = new Date()): Promise<string | null> {
  const supabase = createServiceClient()
  const dateStr = date.toISOString().slice(0, 10)

  const { data: sched } = await supabase
    .from('schedules')
    .select('vehicle_id, shift')
    .eq('driver_id', driverId)
    .eq('scheduled_date', dateStr)

  const scheduledVehicle = (sched ?? [])
    .filter(r => !(r.shift ?? '').includes('休'))
    .map(r => r.vehicle_id)
    .find(v => !!v) as string | undefined
  if (scheduledVehicle) return scheduledVehicle

  const { data: driver } = await supabase
    .from('drivers')
    .select('default_vehicle_id')
    .eq('id', driverId)
    .maybeSingle()
  return driver?.default_vehicle_id ?? null
}
