'use client'
import { useState } from 'react'
import { PencilLine, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteVendor } from '@/app/(dashboard)/vendors/actions'
import VendorFormModal, { type VendorRow } from './VendorFormModal'

interface Props {
  vendor: VendorRow
}

export default function VendorRowActions({ vendor }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm(`確定刪除廠商「${vendor.name}」？\n注意：若有相關運費規則或車趟紀錄，刪除可能會失敗。`)) return
    setBusy(true)
    const { error } = await deleteVendor(vendor.id)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <VendorFormModal
        mode="edit"
        initial={vendor}
        trigger={<button className="icon-btn" disabled={busy} title="編輯"><PencilLine size={14} /></button>}
      />
      <button className="icon-btn danger" onClick={handleDelete} disabled={busy} title="刪除">
        {busy ? '…' : <Trash2 size={14} />}
      </button>
    </div>
  )
}
