'use client'
import { useState } from 'react'
import { PencilLine, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteVehicle } from '@/app/(dashboard)/vehicles/actions'
import VehicleFormModal, { type VehicleRow } from './VehicleFormModal'

interface Props {
  vehicle: VehicleRow
}

export default function VehicleRowActions({ vehicle }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm(`確定刪除車輛「${vehicle.plate_number}」？\n注意：若有相關車趟、加油、保養紀錄，刪除可能會失敗。`)) return
    setBusy(true)
    const { error } = await deleteVehicle(vehicle.id)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <VehicleFormModal
        mode="edit"
        initial={vehicle}
        trigger={<button className="icon-btn" disabled={busy} title="編輯"><PencilLine size={14} /></button>}
      />
      <button className="icon-btn danger" onClick={handleDelete} disabled={busy} title="刪除">
        {busy ? '…' : <Trash2 size={14} />}
      </button>
    </div>
  )
}
