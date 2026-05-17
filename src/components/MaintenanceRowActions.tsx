'use client'
import { useState } from 'react'
import { PencilLine, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteMaintenanceLog } from '@/app/(dashboard)/maintenance/actions'
import MaintenanceFormModal, { type MaintenanceRow } from './MaintenanceFormModal'

type Vehicle = { id: string; plate_number: string }

interface Props {
  log:      MaintenanceRow
  vehicles: Vehicle[]
  vendorNames?: string[]
}

export default function MaintenanceRowActions({ log, vehicles, vendorNames }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm(`確定刪除這筆保養紀錄？${log.receipt_url ? '\n（單據檔案也會一併刪除）' : ''}`)) return
    setBusy(true)
    const { error } = await deleteMaintenanceLog(log.id, log.receipt_url)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <MaintenanceFormModal
        vehicles={vehicles}
        vendorNames={vendorNames}
        mode="edit"
        initial={log}
        trigger={<button className="icon-btn" disabled={busy} title="編輯"><PencilLine size={14} /></button>}
      />
      <button className="icon-btn danger" onClick={handleDelete} disabled={busy} title="刪除">
        {busy ? '…' : <Trash2 size={14} />}
      </button>
    </div>
  )
}
