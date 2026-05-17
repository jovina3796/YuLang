'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PencilLine, Trash2 } from 'lucide-react'
import { deleteFixedExpense } from '@/app/(dashboard)/fixed/actions'
import FixedExpenseFormModal, { type FixedExpenseRow } from './FixedExpenseFormModal'

type Vehicle = { id: string; plate_number: string }

export default function FixedExpenseRowActions({ row, vehicles }: { row: FixedExpenseRow; vehicles: Vehicle[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm(`確定刪除「${row.name}」？`)) return
    setBusy(true)
    const { error } = await deleteFixedExpense(row.id)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <FixedExpenseFormModal
        vehicles={vehicles}
        mode="edit"
        initial={row}
        trigger={<button className="icon-btn" disabled={busy} title="編輯"><PencilLine size={14} /></button>}
      />
      <button className="icon-btn danger" onClick={handleDelete} disabled={busy} title="刪除">
        {busy ? '…' : <Trash2 size={14} />}
      </button>
    </div>
  )
}
