'use client'
import { useState } from 'react'
import { PencilLine, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createVendor, updateVendor, type VendorInput } from '@/app/(dashboard)/vendors/actions'

export type VendorRow = {
  id:                      string
  name:                    string
  warehouse:               string
  contact_name:            string | null
  phone:                   string | null
  payment_terms:           string | null
  display_order:           number | null
  billing_cycle_start_day: number
  payment_delay_months:    number
}

interface Props {
  mode:     'create' | 'edit'
  initial?: VendorRow
  trigger?: React.ReactNode
}

export default function VendorFormModal({ mode, initial, trigger }: Props) {
  const router = useRouter()

  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)

  const [name,         setName]         = useState(initial?.name ?? '')
  const [warehouse,    setWarehouse]    = useState(initial?.warehouse ?? '')
  const [contactName,  setContactName]  = useState(initial?.contact_name ?? '')
  const [phone,        setPhone]        = useState(initial?.phone ?? '')
  const [paymentTerms, setPaymentTerms] = useState(initial?.payment_terms ?? '')
  const [displayOrder, setDisplayOrder] = useState<number | ''>(initial?.display_order ?? '')
  const [cycleStart,   setCycleStart]   = useState<number>(initial?.billing_cycle_start_day ?? 1)
  const [payDelay,     setPayDelay]     = useState<number>(initial?.payment_delay_months ?? 2)

  function resetForm() {
    if (mode === 'create') {
      setName(''); setWarehouse(''); setContactName(''); setPhone(''); setPaymentTerms(''); setDisplayOrder('')
      setCycleStart(1); setPayDelay(2)
    }
  }

  async function handleSubmit() {
    if (!name.trim() || !warehouse.trim()) return
    const payload: VendorInput = {
      name:                    name.trim(),
      warehouse:               warehouse.trim(),
      contact_name:            contactName.trim() || null,
      phone:                   phone.trim() || null,
      payment_terms:           paymentTerms.trim() || null,
      display_order:           displayOrder === '' ? null : Number(displayOrder),
      billing_cycle_start_day: Math.max(1, Math.min(28, Number(cycleStart) || 1)),
      payment_delay_months:    Math.max(0, Math.min(6,  Number(payDelay)   || 0)),
    }
    setSaving(true)
    const { error } = mode === 'create'
      ? await createVendor(payload)
      : await updateVendor(initial!.id, payload)
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); resetForm(); router.refresh()
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }

  const defaultTrigger = mode === 'create'
    ? <button className="btn btn-primary" onClick={() => setOpen(true)} title="新增廠商" style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px' }}><Plus size={16} /></button>
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
            borderRadius: 14, width: '100%', maxWidth: 480,
            padding: '28px 28px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {mode === 'create' ? '新增廠商' : '編輯廠商'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>廠商名稱</span>
                <input
                  type="text" className="input" value={name}
                  onChange={e => setName(e.target.value)} placeholder="必填"
                />
              </label>
              <label style={L}>
                <span style={LT}>倉庫</span>
                <input
                  type="text" className="input" value={warehouse}
                  onChange={e => setWarehouse(e.target.value)} placeholder="必填，例：汐止倉"
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>聯絡人</span>
                <input
                  type="text" className="input" value={contactName}
                  onChange={e => setContactName(e.target.value)}
                />
              </label>
              <label style={L}>
                <span style={LT}>聯絡電話</span>
                <input
                  type="tel" className="input" value={phone}
                  onChange={e => setPhone(e.target.value)} placeholder="例：02-1234-5678"
                />
              </label>
            </div>

            <label style={L}>
              <span style={LT}>付款條件</span>
              <input
                type="text" className="input" value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)} placeholder="例：月結 30 天"
              />
            </label>

            <label style={L}>
              <span style={LT}>顯示順序（數字越小越前面，留空則排最後）</span>
              <input
                type="number" className="input" value={displayOrder}
                onChange={e => setDisplayOrder(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="例：10"
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>計費期起始日（1=自然月，26=上月26~本月25）</span>
                <input
                  type="number" className="input" min={1} max={28} value={cycleStart}
                  onChange={e => setCycleStart(Number(e.target.value) || 1)}
                />
              </label>
              <label style={L}>
                <span style={LT}>押款月數（計費期結束後幾個月入帳）</span>
                <input
                  type="number" className="input" min={0} max={6} value={payDelay}
                  onChange={e => setPayDelay(Number(e.target.value) || 0)}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={() => { setOpen(false); resetForm() }}>取消</button>
              <button
                className="btn btn-primary"
                disabled={!name.trim() || !warehouse.trim() || saving}
                onClick={handleSubmit}
              >
                {saving ? '儲存中…' : mode === 'create' ? '確認新增' : '儲存變更'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
