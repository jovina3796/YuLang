'use client'
import { useState } from 'react'
import { PencilLine, Paperclip, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  createMiscTransaction, updateMiscTransaction, uploadMiscReceipt,
  type MiscTransactionInput,
} from '@/app/(dashboard)/misc/actions'

export type MiscRow = {
  id:               string
  type:             'income' | 'expense'
  category:         string | null
  amount:           number
  description:      string | null
  transaction_date: string
  deduct_month:     string | null
  notes:            string | null
  receipt_url:      string | null
  payment_method:   string | null
  payment_status:   'paid' | 'pending'
  due_date:         string | null
  paid_at:          string | null
  driver_id:        string | null // 新增
  vehicle_id:       string | null // 新增
}

interface Props {
  mode:     'create' | 'edit'
  initial?: MiscRow
  trigger?: React.ReactNode
  drivers: { id: string; name: string }[]       // 新增
  vehicles: { id: string; plate_number: string }[] // 新增
}

const COMMON_CATEGORIES_EXPENSE = ['停車費', '過路費', '辦公用品', '保險', '罰單', '稅務', '其他支出']
const COMMON_CATEGORIES_INCOME  = ['退款', '補助', '其他收入']

export default function MiscFormModal({ mode, initial, trigger, drivers, vehicles }: Props) {
  const router = useRouter()
  const today  = new Date().toISOString().split('T')[0]

  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)

  const [type,        setType]        = useState<'income' | 'expense'>(initial?.type ?? 'expense')
  const [category,    setCategory]    = useState(initial?.category ?? '')
  const [amount,      setAmount]      = useState<number | ''>(initial?.amount ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [date,        setDate]        = useState(initial?.transaction_date ?? today)
  const [deductMonth, setDeductMonth] = useState(initial?.deduct_month?.slice(0, 7) ?? '')
  const [notes,       setNotes]       = useState(initial?.notes ?? '')
  const [paymentMethod, setPaymentMethod] = useState(initial?.payment_method ?? '')
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending'>(initial?.payment_status ?? 'paid')
  const [dueDate,       setDueDate]       = useState(initial?.due_date ?? '')
  const [paidAt,        setPaidAt]        = useState(initial?.paid_at ?? '')
  
  // 新增狀態
  const [driverId,  setDriverId]  = useState(initial?.driver_id ?? '')
  const [vehicleId, setVehicleId] = useState(initial?.vehicle_id ?? '')

  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(initial?.receipt_url ?? null)
  const [receiptFile,   setReceiptFile]   = useState<File | null>(null)
  const [removeReceipt, setRemoveReceipt] = useState(false)

  function resetForm() {
    if (mode === 'create') {
      setType('expense'); setCategory(''); setAmount(''); setDescription(''); setDate(today); setDeductMonth(''); setNotes('')
      setPaymentMethod(''); setPaymentStatus('paid'); setDueDate(''); setPaidAt('')
      setDriverId(''); setVehicleId('')
      setExistingReceiptUrl(null); setReceiptFile(null); setRemoveReceipt(false)
    } else {
      setReceiptFile(null); setRemoveReceipt(false)
    }
  }

  async function handleSubmit() {
    if (amount === '' || Number(amount) <= 0) return
    setSaving(true)

    let nextReceiptUrl: string | null = existingReceiptUrl
    if (removeReceipt) nextReceiptUrl = null

    if (receiptFile) {
      const fd = new FormData()
      fd.append('file', receiptFile)
      const up = await uploadMiscReceipt(fd)
      if (up.error) {
        setSaving(false)
        alert(`單據上傳失敗：${up.error}`)
        return
      }
      nextReceiptUrl = up.url
    }

    const payload: MiscTransactionInput = {
      type,
      category:         category.trim() || null,
      amount:           Number(amount),
      description:      description.trim() || null,
      transaction_date: date,
      deduct_month:     deductMonth ? `${deductMonth}-01` : null,
      notes:            notes.trim() || null,
      receipt_url:      nextReceiptUrl,
      payment_method:   paymentMethod.trim() || null,
      payment_status:   paymentStatus,
      due_date:         dueDate || null,
      paid_at:          paymentStatus === 'paid' ? (paidAt || date) : (paidAt || null),
      driver_id:        driverId || null,  // 送出空字串轉為 null
      vehicle_id:       vehicleId || null, // 送出空字串轉為 null
    }
    const { error } = mode === 'create'
      ? await createMiscTransaction(payload)
      : await updateMiscTransaction(initial!.id, payload, initial?.receipt_url ?? null)
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); resetForm(); router.refresh()
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }

  const defaultTrigger = mode === 'create'
    ? <button className="btn btn-primary" onClick={() => setOpen(true)} title="新增收支" style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px' }}><Plus size={16} /></button>
    : <button className="icon-btn" onClick={() => setOpen(true)} title="編輯"><PencilLine size={14} /></button>

  const categories = type === 'expense' ? COMMON_CATEGORIES_EXPENSE : COMMON_CATEGORIES_INCOME
  const showExistingReceipt = mode === 'edit' && existingReceiptUrl && !removeReceipt && !receiptFile

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
              {mode === 'create' ? '新增其他收支' : '編輯其他收支'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>類型</span>
                <select className="input" value={type} onChange={e => setType(e.target.value as 'income' | 'expense')}>
                  <option value="expense">支出</option>
                  <option value="income">收入</option>
                </select>
              </label>
              <label style={L}>
                <span style={LT}>日期</span>
                <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>類別</span>
                <input type="text" className="input" value={category} list="misc-categories" onChange={e => setCategory(e.target.value)} placeholder="例：停車費" />
                <datalist id="misc-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </label>
              <label style={L}>
                <span style={LT}>司機 (選填)</span>
                <select className="input" value={driverId} onChange={e => setDriverId(e.target.value)}>
                  <option value="">—</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label style={L}>
                <span style={LT}>車輛 (選填)</span>
                <select className="input" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                  <option value="">—</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>說明</span>
                <input type="text" className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="簡短說明" />
              </label>
              <label style={L}>
                <span style={LT}>金額 (NT$)</span>
                <input type="number" className="input" min={0} step="1" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="必填" />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>扣款年月（選填）</span>
                <input type="month" className="input" value={deductMonth} onChange={e => setDeductMonth(e.target.value)} />
              </label>
              <label style={L}>
                <span style={LT}>備註</span>
                <input type="text" className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="選填" />
              </label>
            </div>

            {/* 付款資訊區塊與單據上傳部分省略以節省篇幅，請保留你原有的該部分程式碼 */}
            {/* ... (這裡放你原本檔案中的付款資訊與單據區塊) ... */}
            
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={() => { setOpen(false); resetForm() }}>取消</button>
              <button
                className="btn btn-primary"
                disabled={amount === '' || Number(amount) <= 0 || saving}
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
