'use client'
import { useState } from 'react'
import { PencilLine, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { upsertDriverVendorRate } from '@/app/(dashboard)/vendor-info/driver-rates/actions'

export type DriverOption = { id: string; name: string }
export type VendorOption = { id: string; name: string; warehouse: string | null }
export type RateRow = { id: string; driver_id: string; vendor_id: string; commission_rate: number }

interface Props {
  mode:     'create' | 'edit'
  drivers:  DriverOption[]
  vendors:  VendorOption[]
  initial?: RateRow
  trigger?: React.ReactNode
}

export default function DriverVendorRateModal({ mode, drivers, vendors, initial, trigger }: Props) {
  const router = useRouter()
  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)

  const [driverId, setDriverId] = useState(initial?.driver_id ?? '')
  const [vendorId, setVendorId] = useState(initial?.vendor_id ?? '')
  const [rate,     setRate]     = useState<number | ''>(initial?.commission_rate ?? '')

  function resetForm() {
    if (mode === 'create') {
      setDriverId(''); setVendorId(''); setRate('')
    }
  }

  async function handleSubmit() {
    if (!driverId || !vendorId || rate === '') return
    setSaving(true)
    const { error } = await upsertDriverVendorRate({
      driver_id: driverId,
      vendor_id: vendorId,
      commission_rate: Number(rate),
    })
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); resetForm(); router.refresh()
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }

  const defaultTrigger = mode === 'create'
    ? <button className="btn btn-primary" onClick={() => setOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px' }}><Plus size={16} /></button>
    : <button className="icon-btn" onClick={() => setOpen(true)} title="編輯"><PencilLine size={14} /></button>

  return (
    <>
      {trigger
        ? <span onClick={() => setOpen(true)} style={{ display: 'inline-flex' }}>{trigger}</span>
        : defaultTrigger}

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={e => e.target === e.currentTarget && (setOpen(false), resetForm())}
        >
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 14, width: '100%', maxWidth: 440,
            padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {mode === 'create' ? '新增司機個別抽成規則' : '修改個別抽成規則'}
            </div>

            <label style={L}>
              <span style={LT}>選擇司機</span>
              <select
                className="input" value={driverId} disabled={mode === 'edit'}
                onChange={e => setDriverId(e.target.value)}
              >
                <option value="">-- 請選擇 --</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>

            <label style={L}>
              <span style={LT}>選擇廠商</span>
              <select
                className="input" value={vendorId} disabled={mode === 'edit'}
                onChange={e => setVendorId(e.target.value)}
              >
                <option value="">-- 請選擇 --</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.warehouse ? `／${v.warehouse}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label style={L}>
              <span style={LT}>例外抽成比例 (%)</span>
              <input
                type="number" step="0.1" min="0" max="100" className="input"
                value={rate} onChange={e => setRate(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="例如：8 (代表該司機跑此廠商只抽 8%)"
              />
              <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                設定後，此規則優先級將高於廠商的預設抽成比率。
              </span>
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn" onClick={() => { setOpen(false); resetForm() }}>取消</button>
              <button
                className="btn btn-primary"
                disabled={!driverId || !vendorId || rate === '' || saving}
                onClick={handleSubmit}
              >
                {saving ? '儲存中…' : '儲存變更'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
