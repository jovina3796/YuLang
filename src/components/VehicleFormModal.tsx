'use client'
import { useState, useMemo } from 'react'
import { PencilLine, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createVehicle, updateVehicle, type VehicleInput } from '@/app/(dashboard)/vehicles/actions'

export type VehicleRow = {
  id:                    string
  plate_number:          string
  category:              string | null
  model:                 string | null
  manufacture_date:      string | null
  mileage:               number
  last_inspection_date:  string | null
  next_inspection_date:  string | null
  status:                string
  display_order:         number | null
}

interface Props {
  mode:     'create' | 'edit'
  initial?: VehicleRow
  trigger?: React.ReactNode
}

// <5 yr old: every 12 months. ≥5 yr: every 6 months.
export function computeNextInspection(manufactureDate: string, lastInspectionDate: string): string {
  const last = new Date(lastInspectionDate)
  const manufacture = new Date(manufactureDate)
  const ageYears = (Date.now() - manufacture.getTime()) / (365.25 * 86400000)
  const monthsToAdd = ageYears < 5 ? 12 : 6
  const next = new Date(last)
  next.setMonth(next.getMonth() + monthsToAdd)
  return next.toISOString().split('T')[0]
}

function toMonthInput(d: string | null) {
  if (!d) return ''
  return d.slice(0, 7) // YYYY-MM
}

export default function VehicleFormModal({ mode, initial, trigger }: Props) {
  const router = useRouter()

  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)

  const [plateNumber,  setPlateNumber]  = useState(initial?.plate_number ?? '')
  const [category,     setCategory]     = useState(initial?.category ?? '營業小貨車')
  const [model,        setModel]        = useState(initial?.model ?? '')
  const [manufactureM, setManufactureM] = useState(toMonthInput(initial?.manufacture_date ?? null))
  const [mileage,      setMileage]      = useState<number | ''>(initial?.mileage ?? 0)
  const [lastInspect,  setLastInspect]  = useState(initial?.last_inspection_date ?? '')
  const [status,       setStatus]       = useState(initial?.status ?? 'active')
  const [displayOrder, setDisplayOrder] = useState<number | ''>(initial?.display_order ?? '')

  const nextInspect = useMemo(() => {
    const mDate = manufactureM ? `${manufactureM}-01` : ''
    if (!mDate || !lastInspect) return ''
    return computeNextInspection(mDate, lastInspect)
  }, [manufactureM, lastInspect])

  function resetForm() {
    if (mode === 'create') {
      setPlateNumber(''); setCategory('營業小貨車'); setModel(''); setManufactureM('')
      setMileage(0); setLastInspect(''); setStatus('active'); setDisplayOrder('')
    }
  }

  async function handleSubmit() {
    if (!plateNumber.trim()) return
    const payload: VehicleInput = {
      plate_number:          plateNumber.trim(),
      category:              category || null,
      model:                 model.trim() || null,
      manufacture_date:      manufactureM ? `${manufactureM}-01` : null,
      mileage:               mileage === '' ? 0 : Number(mileage),
      last_inspection_date:  lastInspect || null,
      next_inspection_date:  nextInspect || null,
      status,
      display_order:         displayOrder === '' ? null : Number(displayOrder),
    }
    setSaving(true)
    const { error } = mode === 'create'
      ? await createVehicle(payload)
      : await updateVehicle(initial!.id, payload)
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); resetForm(); router.refresh()
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }

  const defaultTrigger = mode === 'create'
    ? <button className="btn btn-primary" onClick={() => setOpen(true)} title="新增車輛" style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px' }}><Plus size={16} /></button>
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
            borderRadius: 14, width: '100%', maxWidth: 560,
            padding: '28px 28px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {mode === 'create' ? '新增車輛' : '編輯車輛'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>車牌號碼</span>
                <input
                  type="text" className="input" value={plateNumber}
                  onChange={e => setPlateNumber(e.target.value)} placeholder="例：ABC-1234"
                />
              </label>
              <label style={L}>
                <span style={LT}>車輛類別</span>
                <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="營業小貨車">營業小貨車</option>
                  <option value="大貨車">大貨車</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>車型</span>
                <input
                  type="text" className="input" value={model}
                  onChange={e => setModel(e.target.value)} placeholder="例：Hino 300"
                />
              </label>
              <label style={L}>
                <span style={LT}>出廠年月</span>
                <input
                  type="month" className="input" value={manufactureM}
                  onChange={e => setManufactureM(e.target.value)}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>里程數 (km)</span>
                <input
                  type="number" className="input" min={0} value={mileage}
                  onChange={e => setMileage(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label style={L}>
                <span style={LT}>狀態</span>
                <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="active">正常</option>
                  <option value="maintenance">維修</option>
                  <option value="retired">退役</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>驗車日期</span>
                <input
                  type="date" className="input" value={lastInspect}
                  onChange={e => setLastInspect(e.target.value)}
                />
              </label>
              <label style={L}>
                <span style={LT}>下次驗車日期（自動計算）</span>
                <input
                  type="date" className="input" value={nextInspect} disabled
                  placeholder="輸入出廠年月與驗車日期後自動計算"
                />
              </label>
            </div>

            {manufactureM && lastInspect && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: -6 }}>
                依出廠 {manufactureM}（
                {(() => {
                  const m = new Date(`${manufactureM}-01`)
                  const yrs = (Date.now() - m.getTime()) / (365.25 * 86400000)
                  return yrs < 5 ? '未滿 5 年，每年 1 驗' : '已滿 5 年，每半年 1 驗'
                })()}）
              </div>
            )}

            <label style={L}>
              <span style={LT}>顯示順序（數字越小越前面，留空則排最後）</span>
              <input
                type="number" className="input" value={displayOrder}
                onChange={e => setDisplayOrder(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="例：10"
              />
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={() => { setOpen(false); resetForm() }}>取消</button>
              <button
                className="btn btn-primary"
                disabled={!plateNumber.trim() || saving}
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
