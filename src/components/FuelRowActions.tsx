'use client'
import { useState } from 'react'
import { PencilLine, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteFuelLog } from '@/app/(dashboard)/fuel/actions'
import FuelFormModal, { type FuelRow } from './FuelFormModal'

type Vehicle = { id: string; plate_number: string }

interface Props {
  log:      FuelRow
  vehicles: Vehicle[]
}

export default function FuelRowActions({ log, vehicles }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm('確定刪除這筆加油紀錄？')) return
    setBusy(true)
    const { error } = await deleteFuelLog(log.id)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <FuelFormModal
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
