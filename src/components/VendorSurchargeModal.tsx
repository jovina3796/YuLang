'use client'
import { useState } from 'react'
import { PencilLine, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createVendorSurcharge, updateVendorSurcharge } from '@/app/(dashboard)/vendor-info/surcharges/actions'

export type SurchargeRow = { id: string; vendor_id: string; name: string; keyword: string; rate: number; display_order: number }

interface Props {
  mode:     'create' | 'edit'
  vendors:  { id: string; name: string; warehouse: string | null }[]
  initial?: SurchargeRow
}

export default function VendorSurchargeModal({ mode, vendors, initial }: Props) {
  const router = useRouter()
  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)

  const [vendorId, setVendorId] = useState(initial?.vendor_id ?? '')
  const [name,     setName]     = useState(initial?.name ?? '')
  const [keyword,  setKeyword]  = useState(initial?.keyword ?? '')
  const [ratePct,  setRatePct]  = useState<number | ''>(initial?.rate ? initial.rate * 100 : '')
  const [order,    setOrder]    = useState<number | ''>(initial?.display_order ?? 10)

  function resetForm() {
    if (mode === 'create') {
      setVendorId(''); setName(''); setKeyword(''); setRatePct(''); setOrder(10)
    }
  }

  async function handleSubmit() {
    if (!vendorId || !name.trim() || !keyword.trim() || ratePct === '') return
    setSaving(true)
    
    const payload = {
      vendor_id: vendorId,
      name: name.trim(),
      keyword: keyword.trim(),
      rate: Number(ratePct) / 100, // 畫面的 30% 轉成後端資料庫的 0.3
      display_order: order === '' ? 10 : Number(order),
    }

    const { error } = mode === 'create'
      ? await createVendorSurcharge(payload)
      : await updateVendorSurcharge(initial!.id, payload)
      
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); resetForm(); router.refresh()
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }

  return (
    <>
      {mode === 'create' ? (
        <button className="btn btn-primary" onClick={() => setOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px' }}><Plus size={16} /></button>
      ) : (
        <button className="icon-btn" onClick={() => setOpen(true)} title="編輯"><PencilLine size={14} /></button>
      )}

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && (setOpen(false), resetForm())}
        >
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, width: '100%', maxWidth: 440, padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {mode === 'create' ? '新增廠商特殊加成方案' : '修改特殊加成方案'}
            </div>

            <label style={L}>
              <span style={LT}>適用廠商</span>
              <select className="input" value={vendorId} disabled={mode === 'edit'} onChange={e => setVendorId(e.target.value)}>
                <option value="">-- 請選擇廠商 --</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.warehouse ? ` (${v.warehouse})` : ''}</option>)}
              </select>
            </label>

            <label style={L}>
              <span style={LT}>加成名稱（對帳單呈現）</span>
              <input type="text" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="例：颱風假加成30%" />
            </label>

            <label style={L}>
              <span style={LT}>LINE 回報關鍵字</span>
              <input type="text" className="input" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="例：颱風假" />
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>司機在 LINE 報趟結尾加上此字眼即會觸發此加成。</span>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>加成比例 (%)</span>
                <input type="number" step="1" className="input" value={ratePct} onChange={e => setRatePct(e.target.value === '' ? '' : Number(e.target.value))} placeholder="例：30" />
              </label>
              <label style={L}>
                <span style={LT}>顯示順序</span>
                <input type="number" className="input" value={order} onChange={e => setOrder(e.target.value === '' ? '' : Number(e.target.value))} />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn" onClick={() => { setOpen(false); resetForm() }}>取消</button>
              <button className="btn btn-primary" disabled={!vendorId || !name.trim() || !keyword.trim() || ratePct === '' || saving} onClick={handleSubmit}>
                {saving ? '儲存中…' : '儲存變更'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
