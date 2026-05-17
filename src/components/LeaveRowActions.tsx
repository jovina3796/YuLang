'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Trash2 } from 'lucide-react'
import LeaveFormModal, { type LeaveRow } from './LeaveFormModal'
import {
  approveLeave, rejectLeave, deleteLeave,
  type LeaveStatus,
} from '@/app/(dashboard)/leaves/actions'

interface Props {
  leave: LeaveRow & { status: LeaveStatus }
  drivers: { id: string; name: string }[]
  reviewer: string | null
}

export default function LeaveRowActions({ leave, drivers, reviewer }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function doApprove() {
    if (!confirm('核准此請假？')) return
    setBusy(true)
    const { error } = await approveLeave(leave.id, reviewer)
    setBusy(false)
    if (error) { alert(`核准失敗：${error}`); return }
    router.refresh()
  }
  async function doReject() {
    const reason = prompt('退回原因？', '')
    if (reason === null) return
    setBusy(true)
    const { error } = await rejectLeave(leave.id, reviewer, reason)
    setBusy(false)
    if (error) { alert(`退回失敗：${error}`); return }
    router.refresh()
  }
  async function doDelete() {
    if (!confirm('確定刪除？')) return
    setBusy(true)
    const { error } = await deleteLeave(leave.id)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      {leave.status === 'pending' && (
        <>
          <button className="icon-btn" disabled={busy} onClick={doApprove} title="核准">
            <Check size={14} style={{ color: 'var(--accent2)' }} />
          </button>
          <button className="icon-btn" disabled={busy} onClick={doReject} title="退回">
            <X size={14} style={{ color: 'var(--red)' }} />
          </button>
        </>
      )}
      <LeaveFormModal mode="edit" drivers={drivers} initial={leave} />
      <button className="icon-btn danger" disabled={busy} onClick={doDelete} title="刪除">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
