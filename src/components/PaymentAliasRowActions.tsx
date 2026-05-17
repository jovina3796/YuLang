'use client'
import { useState } from 'react'
import { PencilLine, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deletePaymentAlias } from '@/app/(dashboard)/payment-aliases/actions'
import PaymentAliasFormModal, { type PaymentAliasRow } from './PaymentAliasFormModal'

interface Props {
  row: PaymentAliasRow
}

export default function PaymentAliasRowActions({ row }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm(`確定刪除別名「${row.alias}」？`)) return
    setBusy(true)
    const { error } = await deletePaymentAlias(row.id)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <PaymentAliasFormModal
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
