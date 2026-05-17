'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Wallet, Trash2 } from 'lucide-react'
import ClaimFormModal, { type ClaimRow } from './ClaimFormModal'
import {
  approveClaim, rejectClaim, markClaimPaid, deleteClaim,
  type ClaimStatus,
} from '@/app/(dashboard)/claims/actions'

interface Props {
  claim: ClaimRow & { status: ClaimStatus }
  drivers: { id: string; name: string }[]
  reviewer: string | null
}

export default function ClaimRowActions({ claim, drivers, reviewer }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function doApprove() {
    if (!confirm('核准此請款？將同步建立一筆待支付項目。')) return
    setBusy(true)
    const { error } = await approveClaim(claim.id, reviewer)
    setBusy(false)
    if (error) { alert(`核准失敗：${error}`); return }
    router.refresh()
  }

  async function doReject() {
    const reason = prompt('退回原因？', '')
    if (reason === null) return
    setBusy(true)
    const { error } = await rejectClaim(claim.id, reviewer, reason)
    setBusy(false)
    if (error) { alert(`退回失敗：${error}`); return }
    router.refresh()
  }

  async function doPaid() {
    if (!confirm('標記為已支付？')) return
    setBusy(true)
    const { error } = await markClaimPaid(claim.id)
    setBusy(false)
    if (error) { alert(`更新失敗：${error}`); return }
    router.refresh()
  }

  async function doDelete() {
    if (!confirm('確定刪除？關聯的待支付項目也會一併移除。')) return
    setBusy(true)
    const { error } = await deleteClaim(claim.id)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      {claim.status === 'pending' && (
        <>
          <button className="icon-btn" disabled={busy} onClick={doApprove} title="核准">
            <Check size={14} style={{ color: 'var(--accent2)' }} />
          </button>
          <button className="icon-btn" disabled={busy} onClick={doReject} title="退回">
            <X size={14} style={{ color: 'var(--red)' }} />
          </button>
        </>
      )}
      {claim.status === 'approved' && (
        <button className="icon-btn" disabled={busy} onClick={doPaid} title="標記已支付">
          <Wallet size={14} style={{ color: 'var(--accent2)' }} />
        </button>
      )}
      {claim.status !== 'paid' && (
        <ClaimFormModal mode="edit" drivers={drivers} initial={claim} />
      )}
      <button className="icon-btn danger" disabled={busy} onClick={doDelete} title="刪除">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
