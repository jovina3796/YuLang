'use client'
import { useState } from 'react'
import { PencilLine, Trash2, Unlink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteDriver } from '@/app/(dashboard)/drivers/actions'
import { unbindLine } from '@/app/(dashboard)/users/actions'
import DriverFormModal, { type DriverRow } from './DriverFormModal'

interface Props {
  driver: DriverRow
  vehicles: { id: string; plate_number: string }[]
}

export default function DriverRowActions({ driver, vehicles }: Props) {
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

  async function handleUnbindLine() {
    if (!confirm(`確定解除司機「${driver.name}」的 LINE 綁定？\n司機資料與登入帳號會同步清除綁定。`)) return
    setBusy(true)
    const { error } = await unbindLine(driver.id)
    setBusy(false)
    if (error) { alert(`解除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <DriverFormModal
        vehicles={vehicles}
        mode="edit"
        initial={driver}
        trigger={<button className="icon-btn" disabled={busy} title="編輯"><PencilLine size={14} /></button>}
      />
      {driver.line_user_id && (
        <button className="icon-btn" onClick={handleUnbindLine} disabled={busy} title="解除 LINE 綁定">
          <Unlink size={14} />
        </button>
      )}
      <button className="icon-btn danger" onClick={handleDelete} disabled={busy} title="刪除">
        {busy ? '…' : <Trash2 size={14} />}
      </button>
    </div>
  )
}
