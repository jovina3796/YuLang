'use client'
import { useState } from 'react'
import { PencilLine, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteInspectionLog } from '@/app/(dashboard)/inspection/actions'
import InspectionFormModal, { type InspectionRow } from './InspectionFormModal'

type Vehicle = { id: string; plate_number: string; manufacture_date?: string | null }

interface Props {
  log:      InspectionRow
  vehicles: Vehicle[]
}

export default function InspectionRowActions({ log, vehicles }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    const hasFiles = log.license_url || log.receipt_url
    if (!confirm(`確定刪除這筆驗車紀錄？${hasFiles ? '\n（附件檔案也會一併刪除）' : ''}`)) return
    setBusy(true)
    const { error } = await deleteInspectionLog(log.id, log.license_url, log.receipt_url)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <InspectionFormModal
        vehicles={vehicles}
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
