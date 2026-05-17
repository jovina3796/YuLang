'use client'
import { useState } from 'react'
import { PencilLine, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteMiscTransaction } from '@/app/(dashboard)/misc/actions'
import MiscFormModal, { type MiscRow } from './MiscFormModal'

export default function MiscRowActions({ tx }: { tx: MiscRow }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm('確定刪除這筆收支紀錄？')) return
    setBusy(true)
    const { error } = await deleteMiscTransaction(tx.id, tx.receipt_url ?? null)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <MiscFormModal
        mode="edit"
        initial={tx}
        trigger={<button className="icon-btn" disabled={busy} title="編輯"><PencilLine size={14} /></button>}
      />
      <button className="icon-btn danger" onClick={handleDelete} disabled={busy} title="刪除">
        {busy ? '…' : <Trash2 size={14} />}
      </button>
    </div>
  )
}
