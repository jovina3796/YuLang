export type DriverStatus = 'active' | 'inactive' | 'leave'
export type VehicleStatus = 'active' | 'maintenance' | 'retired'
export type TripStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type UserRole = 'driver' | 'supervisor' | 'accountant' | 'owner'

export interface Driver {
  id: string
  name: string
  phone: string | null
  license_type: string | null
  line_user_id: string | null
  status: DriverStatus
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: string
  plate_number: string
  category: string | null
  model: string | null
  manufacture_date: string | null
  mileage: number
  status: VehicleStatus
  last_inspection_date: string | null
  next_inspection_date: string | null
  display_order: number | null
  created_at: string
  updated_at: string
}

export interface Vendor {
  id: string
  name: string
  warehouse: string
  contact_name: string | null
  phone: string | null
  payment_terms: string | null
  billing_cycle_start_day: number
  payment_delay_months: number
}

export interface Trip {
  id: string
  trip_code: string | null
  driver_id: string
  vehicle_id: string
  vendor_id: string | null
  rate_rule_id: string | null
  origin: string | null
  destination_area: string | null
  departed_at: string | null
  arrived_at: string | null
  actual_stops: number | null
  is_kpi_achieved: boolean | null
  calculated_fare: number | null
  final_fare: number | null
  status: TripStatus
  notes: string | null
  created_at: string
  updated_at: string
  // joined
  driver?: { name: string }
  vehicle?: { plate_number: string }
  vendor?: { name: string; warehouse: string }
}

export interface FuelLog {
  id: string
  vehicle_id: string
  driver_id: string | null
  liters: number | null
  price_per_liter: number | null
  total_cost: number | null
  mileage_at_refuel: number | null
  station_name: string | null
  payment_method: string | null
  notes: string | null
  logged_at: string
  vehicle?: { plate_number: string }
}

export interface MaintenanceLog {
  id: string
  vehicle_id: string
  type: string
  vendor_name: string | null
  cost: number | null
  mileage_at_service: number | null
  serviced_at: string
  next_due_date: string | null
  notes: string | null
  vehicle?: { plate_number: string }
}
