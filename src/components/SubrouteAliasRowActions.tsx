'use client'
import { useState } from 'react'
import { PencilLine, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteSubrouteAlias } from '@/app/(dashboard)/vendor-info/subroutes/actions'
import SubrouteAliasFormModal, { type SubrouteAliasRow } from './SubrouteAliasFormModal'

interface Props {
  row:          SubrouteAliasRow
  billingAreas: string[]
}

export default function SubrouteAliasRowActions({ row, billingAreas }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm(`確定刪除「${row.alias} → ${row.billing_area}」？`)) return
    setBusy(true)
    const { error } = await deleteSubrouteAlias(row.alias)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
      <SubrouteAliasFormModal
        mode="edit"
        initial={row}
        billingAreas={billingAreas}
        trigger={<button className="icon-btn" disabled={busy} title="編輯"><PencilLine size={14} /></button>}
      />
      <button className="icon-btn danger" onClick={handleDelete} disabled={busy} title="刪除">
        {busy ? '…' : <Trash2 size={14} />}
      </button>
    </div>
  )
}
