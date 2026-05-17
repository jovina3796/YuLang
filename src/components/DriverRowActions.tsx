'use client'
import { useState } from 'react'
import { PencilLine, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteDriver } from '@/app/(dashboard)/drivers/actions'
import DriverFormModal, { type DriverRow } from './DriverFormModal'

interface Props {
  driver: DriverRow
}

export default function DriverRowActions({ driver }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm(`確定刪除司機「${driver.name}」？\n注意：若有相關車趟或排班紀錄，刪除可能會失敗。`)) return
    setBusy(true)
    const { error } = await deleteDriver(driver.id)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <DriverFormModal
        mode="edit"
        initial={driver}
        trigger={<button className="icon-btn" disabled={busy} title="編輯"><PencilLine size={14} /></button>}
      />
      <button className="icon-btn danger" onClick={handleDelete} disabled={busy} title="刪除">
        {busy ? '…' : <Trash2 size={14} />}
      </button>
    </div>
  )
}
