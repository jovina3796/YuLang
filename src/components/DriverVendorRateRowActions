'use client'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteDriverVendorRate } from '@/app/(dashboard)/vendor-info/driver-rates/actions'
import DriverVendorRateModal, { DriverOption, VendorOption, RateRow } from './DriverVendorRateModal'

interface Props {
  row:     RateRow
  drivers: DriverOption[]
  vendors: VendorOption[]
}

export default function DriverVendorRateRowActions({ row, drivers, vendors }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm('確定刪除此筆例外規則？\n刪除後該司機將恢復適用廠商預設抽成。')) return
    setBusy(true)
    const { error } = await deleteDriverVendorRate(row.id)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
      <DriverVendorRateModal mode="edit" drivers={drivers} vendors={vendors} initial={row} />
      <button className="icon-btn danger" onClick={handleDelete} disabled={busy} title="刪除">
        {busy ? '…' : <Trash2 size={14} />}
      </button>
    </div>
  )
}
