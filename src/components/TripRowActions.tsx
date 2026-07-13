'use client'
import { useState } from 'react'
import { PencilLine, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteTrip } from '@/app/(dashboard)/trips/actions'
import TripFormModal, { type TripRow } from './TripFormModal'

type Vendor = { id: string; name: string; warehouse: string | null }
type RateRule = {
  id: string; vendor_id: string; service_type: string; destination_area: string | null
  base_trips: number | null
  base_fare: number | null; kpi_fare: number | null; base_stops: number | null
  surcharge_per_stop: number | null; pricing_mode: string
  special_rate: number | null; special_rate_note: string | null
  display_order: number | null
}
type Driver  = { id: string; name: string }
type Vehicle = { id: string; plate_number: string }

interface Props {
  trip:      TripRow
  vendors:   Vendor[]
  rateRules: RateRule[]
  drivers:   Driver[]
  vehicles:  Vehicle[]
  surcharges: any[]
}

export default function TripRowActions({ trip, vendors, rateRules, drivers, vehicles, surcharges }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm('確定刪除這筆車趟紀錄？')) return
    setBusy(true)
    const { error } = await deleteTrip(trip.id)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
      <TripFormModal
        vendors={vendors}
        rateRules={rateRules}
        drivers={drivers}
        vehicles={vehicles}
        mode="edit"
        initial={trip}
        surcharges={surcharges}
        trigger={<button className="icon-btn" disabled={busy} title="編輯"><PencilLine size={14} /></button>}
      />
      <button className="icon-btn danger" onClick={handleDelete} disabled={busy} title="刪除">
        {busy ? '…' : <Trash2 size={14} />}
      </button>
    </div>
  )
}
