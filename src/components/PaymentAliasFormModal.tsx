'use client'
import { useState } from 'react'
import { PencilLine, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createPaymentAlias, updatePaymentAlias, type PaymentAliasInput } from '@/app/(dashboard)/payment-aliases/actions'

export type PaymentAliasRow = {
  id:     string
  alias:  string
  target: string
}

interface Props {
  mode:     'create' | 'edit'
  initial?: PaymentAliasRow
  trigger?: React.ReactNode
}

export default function PaymentAliasFormModal({ mode, initial, trigger }: Props) {
  const router = useRouter()
  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [alias,  setAlias]  = useState(initial?.alias  ?? '')
  const [target, setTarget] = useState(initial?.target ?? '')

  function resetForm() {
    if (mode === 'create') { setAlias(''); setTarget('') }
  }

  async function handleSubmit() {
    if (!alias.trim() || !target.trim()) return
    const payload: PaymentAliasInput = { alias: alias.trim(), target: target.trim() }
    setSaving(true)
    const { error } = mode === 'create'
      ? await createPaymentAlias(payload)
      : await updatePaymentAlias(initial!.id, payload)
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); resetForm(); router.refresh()
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }

  const defaultTrigger = mode === 'create'
    ? <button className="btn btn-primary" onClick={() => setOpen(true)} title="新增別名" style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px' }}><Plus size={16} /></button>
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
            borderRadius: 14, width: '100%', maxWidth: 460,
            padding: '28px 28px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {mode === 'create' ? '新增付款別名' : '編輯付款別名'}
            </div>
            <label style={L}>
              <span style={LT}>關鍵字（司機在 LINE 會打的字）</span>
              <input type="text" className="input" value={alias}
                     onChange={e => setAlias(e.target.value)} placeholder="例：阿哲卡、簽單、信用卡" />
            </label>
            <label style={L}>
              <span style={LT}>對應的付款方式（寫入資料庫的值）</span>
              <input type="text" className="input" value={target}
                     onChange={e => setTarget(e.target.value)} placeholder="例：信用卡-呂明哲、公司簽帳、中油聯名卡-劉明潔" />
            </label>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              比對規則：以「關鍵字是否出現在司機輸入中」判斷，多筆別名命中時取「最長關鍵字」。
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={() => { setOpen(false); resetForm() }}>取消</button>
              <button
                className="btn btn-primary"
                disabled={!alias.trim() || !target.trim() || saving}
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
