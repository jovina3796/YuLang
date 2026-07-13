'use client'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteVendorSurcharge, toggleVendorSurcharge } from '@/app/(dashboard)/vendor-info/surcharges/actions'
import VendorSurchargeModal, { type SurchargeRow } from './VendorSurchargeModal'

interface Props {
  row:     SurchargeRow
  vendors: { id: string; name: string; warehouse: string | null }[]
  isActive: boolean
}

export default function VendorSurchargeRowActions({ row, vendors, isActive }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleToggle() {
    setBusy(true)
    const { error } = await toggleVendorSurcharge(row.id, !isActive)
    setBusy(false)
    if (error) alert(`切換狀態失敗：${error}`)
  }

  async function handleDelete() {
    if (!confirm(`確定刪除「${row.name}」加成規則？`)) return
    setBusy(true)
    const { error } = await deleteVendorSurcharge(row.id)
    setBusy(false)
    if (error) alert(`刪除失敗：${error}`)
    else router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
      {/* 狀態切換 Switch 鈕 */}
      <button 
        className={`badge ${isActive ? 'badge-green' : 'badge-red'}`}
        style={{ border: 'none', cursor: 'pointer', padding: '4px 8px' }}
        disabled={busy}
        onClick={handleToggle}
      >
        {isActive ? '啟用中' : '已停用'}
      </button>

      <VendorSurchargeModal mode="edit" vendors={vendors} initial={row} />
      
      <button className="icon-btn danger" onClick={handleDelete} disabled={busy} title="刪除">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
