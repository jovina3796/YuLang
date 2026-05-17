'use client'
import { useState } from 'react'
import { PencilLine, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteRateRule } from '@/app/(dashboard)/rates/actions'
import RateRuleFormModal, { type RateRuleRow } from './RateRuleFormModal'

type Vendor = { id: string; name: string; warehouse: string | null }

interface Props {
  rule:    RateRuleRow
  vendors: Vendor[]
}

export default function RateRuleRowActions({ rule, vendors }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm(`確定刪除這筆規則？\n${rule.service_type}${rule.destination_area ? ` / ${rule.destination_area}` : ''}`)) return
    setBusy(true)
    const { error } = await deleteRateRule(rule.id)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <RateRuleFormModal
        vendors={vendors}
        mode="edit"
        initial={rule}
        trigger={<button className="icon-btn" disabled={busy} title="編輯"><PencilLine size={14} /></button>}
      />
      <button className="icon-btn danger" onClick={handleDelete} disabled={busy} title="刪除">
        {busy ? '…' : <Trash2 size={14} />}
      </button>
    </div>
  )
}
