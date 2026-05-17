'use client'
import { useState } from 'react'
import { PencilLine, Plus, Paperclip } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  createOvertime, updateOvertime, uploadOvertimeReceipt,
  type OvertimeInput,
} from '@/app/(dashboard)/overtimes/actions'

export type OvertimeRow = {
  id:          string
  driver_id:   string
  work_date:   string
  hours:       number
  reason:      string | null
  notes:       string | null
  receipt_url: string | null
}

interface Props {
  drivers:  { id: string; name: string }[]
  mode:     'create' | 'edit'
  initial?: OvertimeRow
}

export default function OvertimeFormModal({ drivers, mode, initial }: Props) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [driverId, setDriverId] = useState(initial?.driver_id ?? '')
  const [workDate, setWorkDate] = useState(initial?.work_date ?? today)
  const [hours,    setHours]    = useState<number | ''>(initial?.hours ?? '')
  const [reason,   setReason]   = useState(initial?.reason ?? '')
  const [notes,    setNotes]    = useState(initial?.notes ?? '')

  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(initial?.receipt_url ?? null)
  const [receiptFile,   setReceiptFile]   = useState<File | null>(null)
  const [removeReceipt, setRemoveReceipt] = useState(false)

  function reset() {
    if (mode === 'create') {
      setDriverId(''); setWorkDate(today); setHours(''); setReason(''); setNotes('')
      setExistingReceiptUrl(null); setReceiptFile(null); setRemoveReceipt(false)
    } else {
      setReceiptFile(null); setRemoveReceipt(false)
    }
  }

  async function handleSubmit() {
    if (!driverId || hours === '' || Number(hours) <= 0) return
    setSaving(true)

    let nextUrl: string | null = existingReceiptUrl
    if (removeReceipt) nextUrl = null
    if (receiptFile) {
      const fd = new FormData()
      fd.append('file', receiptFile)
      const up = await uploadOvertimeReceipt(fd)
      if (up.error) { setSaving(false); alert(`單據上傳失敗：${up.error}`); return }
      nextUrl = up.url
    }

    const payload: OvertimeInput = {
      driver_id: driverId, work_date: workDate, hours: Number(hours),
      reason: reason.trim() || null, notes: notes.trim() || null,
      receipt_url: nextUrl,
    }
    const { error } = mode === 'create'
      ? await createOvertime(payload)
      : await updateOvertime(initial!.id, payload)
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); reset(); router.refresh()
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }

  const trigger = mode === 'create'
    ? <button className="btn btn-primary" onClick={() => setOpen(true)} title="新增加班"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px' }}><Plus size={16} /></button>
    : <button className="icon-btn" onClick={() => setOpen(true)} title="編輯"><PencilLine size={14} /></button>

  return (
    <>
      {trigger}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.65)',
                   backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && (setOpen(false), reset())}
        >
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 14, width: '100%', maxWidth: 460,
            padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 14,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{mode === 'create' ? '新增加班' : '編輯加班'}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>司機</span>
                <select className="input" value={driverId} onChange={e => setDriverId(e.target.value)}>
                  <option value="">— 選擇司機 —</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label style={L}>
                <span style={LT}>日期</span>
                <input type="date" className="input" value={workDate} onChange={e => setWorkDate(e.target.value)} />
              </label>
              <label style={L}>
                <span style={LT}>時數</span>
                <input type="number" className="input" min={0} step="0.5" value={hours}
                       onChange={e => setHours(e.target.value === '' ? '' : Number(e.target.value))} />
              </label>
            </div>

            <label style={L}>
              <span style={LT}>事由</span>
              <input type="text" className="input" value={reason} onChange={e => setReason(e.target.value)} />
            </label>

            <label style={L}>
              <span style={LT}>備註</span>
              <input type="text" className="input" value={notes} onChange={e => setNotes(e.target.value)} />
            </label>

            <div style={{ ...L, gap: 8 }}>
              <span style={LT}>單據（選填）</span>
              {existingReceiptUrl && !removeReceipt && !receiptFile && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 12px',
                }}>
                  <a href={existingReceiptUrl} target="_blank" rel="noopener noreferrer"
                     style={{ color: 'var(--blue)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Paperclip size={13} /> 已上傳單據
                  </a>
                  <button type="button" className="btn btn-sm" style={{ color: 'var(--red)' }}
                          onClick={() => setRemoveReceipt(true)}>移除</button>
                </div>
              )}
              <label className="btn btn-sm" style={{ cursor: 'pointer', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Paperclip size={13} />選擇檔案
                <input type="file" accept="image/*,application/pdf"
                       onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
                       style={{ display: 'none' }} />
              </label>
              {receiptFile && (
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  將上傳：{receiptFile.name}（{(receiptFile.size / 1024).toFixed(0)} KB）
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={() => { setOpen(false); reset() }}>取消</button>
              <button className="btn btn-primary"
                      disabled={!driverId || hours === '' || Number(hours) <= 0 || saving}
                      onClick={handleSubmit}>
                {saving ? '儲存中…' : mode === 'create' ? '確認新增' : '儲存變更'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
