'use client'
import { useState } from 'react'
import { PencilLine, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  createFixedExpense, updateFixedExpense,
  type FixedExpenseInput,
} from '@/app/(dashboard)/fixed/actions'

type Vehicle = { id: string; plate_number: string }

export type FixedExpenseRow = {
  id:          string
  name:        string
  category:    string | null
  amount:      number
  vehicle_id:  string | null
  notes:       string | null
  active:      boolean
  start_month: string | null
  end_month:   string | null
}

interface Props {
  vehicles: Vehicle[]
  mode:     'create' | 'edit'
  initial?: FixedExpenseRow
  trigger?: React.ReactNode
}

const COMMON_CATEGORIES = ['GPS', '靠行費', '保險', '貸款', '租金', '其他固定支出']

export default function FixedExpenseFormModal({ vehicles, mode, initial, trigger }: Props) {
  const router = useRouter()

  const [open,        setOpen]        = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [name,        setName]        = useState(initial?.name ?? '')
  const [category,    setCategory]    = useState(initial?.category ?? '')
  const [amount,      setAmount]      = useState<number | ''>(initial?.amount ?? '')
  const [vehicleId,   setVehicleId]   = useState(initial?.vehicle_id ?? '')
  const [notes,       setNotes]       = useState(initial?.notes ?? '')
  const [active,      setActive]      = useState(initial?.active ?? true)
  const [startMonth,  setStartMonth]  = useState(initial?.start_month?.slice(0, 7) ?? '')
  const [endMonth,    setEndMonth]    = useState(initial?.end_month?.slice(0, 7) ?? '')

  function resetForm() {
    if (mode === 'create') {
      setName(''); setCategory(''); setAmount(''); setVehicleId('')
      setNotes(''); setActive(true); setStartMonth(''); setEndMonth('')
    }
  }

  async function handleSubmit() {
    if (!name.trim() || amount === '' || Number(amount) <= 0) return
    const payload: FixedExpenseInput = {
      name:        name.trim(),
      category:    category.trim() || null,
      amount:      Number(amount),
      vehicle_id:  vehicleId || null,
      notes:       notes.trim() || null,
      active,
      start_month: startMonth ? `${startMonth}-01` : null,
      end_month:   endMonth   ? `${endMonth}-01`   : null,
    }
    setSaving(true)
    const { error } = mode === 'create'
      ? await createFixedExpense(payload)
      : await updateFixedExpense(initial!.id, payload)
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); resetForm(); router.refresh()
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }

  const defaultTrigger = mode === 'create'
    ? <button className="btn btn-primary" onClick={() => setOpen(true)} title="新增固定收支" style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px' }}><Plus size={16} /></button>
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
            borderRadius: 14, width: '100%', maxWidth: 520,
            padding: '28px 28px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {mode === 'create' ? '新增固定收支' : '編輯固定收支'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>項目名稱</span>
                <input
                  type="text" className="input" value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例：GPS 月租"
                />
              </label>
              <label style={L}>
                <span style={LT}>類別</span>
                <input
                  type="text" className="input" value={category}
                  list="fixed-categories"
                  onChange={e => setCategory(e.target.value)}
                  placeholder="例：GPS"
                />
                <datalist id="fixed-categories">
                  {COMMON_CATEGORIES.map(c => <option key={c} value={c} />)}
                </datalist>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>每月金額 (NT$)</span>
                <input
                  type="number" className="input" min={0} step="1" value={amount}
                  onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label style={L}>
                <span style={LT}>對應車輛（選填）</span>
                <select className="input" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                  <option value="">— 不指定 —</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>開始月份（選填）</span>
                <input type="month" className="input" value={startMonth} onChange={e => setStartMonth(e.target.value)} />
              </label>
              <label style={L}>
                <span style={LT}>結束月份（選填）</span>
                <input type="month" className="input" value={endMonth} onChange={e => setEndMonth(e.target.value)} />
              </label>
            </div>

            <label style={L}>
              <span style={LT}>備註</span>
              <input
                type="text" className="input" value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="選填"
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
              <span style={{ fontSize: 13 }}>啟用中（每月自動納入扣項）</span>
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={() => { setOpen(false); resetForm() }}>取消</button>
              <button
                className="btn btn-primary"
                disabled={!name.trim() || amount === '' || Number(amount) <= 0 || saving}
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
