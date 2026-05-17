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
}

interface Props {
  mode:     'create' | 'edit'
  initial?: MiscRow
  trigger?: React.ReactNode
}

const COMMON_CATEGORIES_EXPENSE = ['停車費', '過路費', '辦公用品', '保險', '罰單', '稅務', '其他支出']
const COMMON_CATEGORIES_INCOME  = ['退款', '補助', '其他收入']

export default function MiscFormModal({ mode, initial, trigger }: Props) {
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

  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(initial?.receipt_url ?? null)
  const [receiptFile,   setReceiptFile]   = useState<File | null>(null)
  const [removeReceipt, setRemoveReceipt] = useState(false)

  function resetForm() {
    if (mode === 'create') {
      setType('expense'); setCategory(''); setAmount(''); setDescription(''); setDate(today); setDeductMonth(''); setNotes('')
      setPaymentMethod(''); setPaymentStatus('paid'); setDueDate(''); setPaidAt('')
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>類別</span>
                <input
                  type="text" className="input" value={category}
                  list="misc-categories"
                  onChange={e => setCategory(e.target.value)}
                  placeholder="例：停車費"
                />
                <datalist id="misc-categories">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </label>
              <label style={L}>
                <span style={LT}>金額 (NT$)</span>
                <input
                  type="number" className="input" min={0} step="1" value={amount}
                  onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="必填"
                />
              </label>
            </div>

            <label style={L}>
              <span style={LT}>說明</span>
              <input
                type="text" className="input" value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="簡短說明"
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>扣款年月（選填）</span>
                <input
                  type="month" className="input" value={deductMonth}
                  onChange={e => setDeductMonth(e.target.value)}
                />
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>實際在幾月運費中扣除；空白則用發生日期當月</span>
              </label>
              <label style={L}>
                <span style={LT}>備註</span>
                <input
                  type="text" className="input" value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="選填"
                />
              </label>
            </div>

            <div style={{
              borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 2,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>付款資訊（現金 / 轉帳）</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={L}>
                  <span style={LT}>付款方式</span>
                  <input
                    type="text" className="input" value={paymentMethod}
                    list="misc-payment-methods"
                    onChange={e => setPaymentMethod(e.target.value)}
                    placeholder="例：現金 / 轉帳 / 信用卡"
                  />
                  <datalist id="misc-payment-methods">
                    <option value="現金" />
                    <option value="轉帳" />
                    <option value="信用卡" />
                    <option value="支票" />
                  </datalist>
                </label>
                <label style={L}>
                  <span style={LT}>付款狀態</span>
                  <select
                    className="input" value={paymentStatus}
                    onChange={e => setPaymentStatus(e.target.value as 'paid' | 'pending')}
                  >
                    <option value="paid">已支付</option>
                    <option value="pending">待支付</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={L}>
                  <span style={LT}>應付日期（選填）</span>
                  <input
                    type="date" className="input" value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                  />
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>例：車貸每月繳款日</span>
                </label>
                <label style={L}>
                  <span style={LT}>實付日期（選填）</span>
                  <input
                    type="date" className="input" value={paidAt}
                    onChange={e => setPaidAt(e.target.value)}
                    disabled={paymentStatus === 'pending'}
                  />
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                    {paymentStatus === 'pending' ? '待支付狀態下不可填' : '空白則自動填發生日期'}
                  </span>
                </label>
              </div>
            </div>

            <div style={{ ...L, gap: 8 }}>
              <span style={LT}>單據（圖片 / PDF，選填）</span>

              {showExistingReceipt && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 12px',
                }}>
                  <a href={existingReceiptUrl!} target="_blank" rel="noopener noreferrer"
                     style={{ color: 'var(--blue)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Paperclip size={13} /> 已上傳單據（點此預覽）
                  </a>
                  <button
                    type="button" className="btn btn-sm"
                    style={{ color: 'var(--red)' }}
                    onClick={() => setRemoveReceipt(true)}
                  >移除</button>
                </div>
              )}

              {mode === 'edit' && removeReceipt && !receiptFile && (
                <div style={{ fontSize: 12, color: 'var(--amber2)' }}>
                  ⚠ 儲存後將刪除原單據
                  <button type="button" className="btn btn-sm" style={{ marginLeft: 8 }}
                          onClick={() => setRemoveReceipt(false)}>取消移除</button>
                </div>
              )}

              <label className="btn btn-sm" style={{ cursor: 'pointer', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Paperclip size={13} />選擇檔案
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
                  style={{ display: 'none' }}
                />
              </label>
              {receiptFile && (
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  將上傳：{receiptFile.name}（{(receiptFile.size / 1024).toFixed(0)} KB）
                  {existingReceiptUrl && !removeReceipt && '（會取代原單據）'}
                </span>
              )}
            </div>

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
