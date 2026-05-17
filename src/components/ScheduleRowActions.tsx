'use client'
import { useState } from 'react'
import { PencilLine, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteSchedule } from '@/app/(dashboard)/schedule/actions'
import ScheduleFormModal, { type ScheduleRow } from './ScheduleFormModal'

type Driver  = { id: string; name: string }
type Vehicle = { id: string; plate_number: string }

interface Props {
  schedule: ScheduleRow
  drivers:  Driver[]
  vehicles: Vehicle[]
}

export default function ScheduleRowActions({ schedule, drivers, vehicles }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm(`確定刪除 ${schedule.scheduled_date} 的排班？`)) return
    setBusy(true)
    const { error } = await deleteSchedule(schedule.id)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <ScheduleFormModal
        drivers={drivers}
        vehicles={vehicles}
        mode="edit"
        initial={schedule}
        trigger={<button className="icon-btn" disabled={busy} title="編輯"><PencilLine size={14} /></button>}
      />
      <button className="icon-btn danger" onClick={handleDelete} disabled={busy} title="刪除">
        {busy ? '…' : <Trash2 size={14} />}
      </button>
    </div>
  )
}
