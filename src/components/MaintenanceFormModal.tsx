'use client'
import { useState } from 'react'
import { PencilLine, Paperclip, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  createMaintenanceLog, updateMaintenanceLog, uploadReceipt,
  type MaintenanceInput,
} from '@/app/(dashboard)/maintenance/actions'

type Vehicle = { id: string; plate_number: string }

export type MaintenanceRow = {
  id:                 string
  vehicle_id:         string
  type:               string
  vendor_name:        string | null
  cost:               number | null
  mileage_at_service: number | null
  serviced_at:        string
  next_due_date:      string | null
  deduct_month:       string | null
  notes:              string | null
  receipt_url:        string | null
}

interface Props {
  vehicles: Vehicle[]
  vendorNames?: string[]
  mode:     'create' | 'edit'
  initial?: MaintenanceRow
  trigger?: React.ReactNode
}

export default function MaintenanceFormModal({ vehicles, vendorNames = [], mode, initial, trigger }: Props) {
  const router = useRouter()
  const today  = new Date().toISOString().split('T')[0]

  const [open,        setOpen]        = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [vehicleId,   setVehicleId]   = useState(initial?.vehicle_id ?? '')
  const [type,        setType]        = useState(initial?.type ?? '')
  const [vendorName,  setVendorName]  = useState(initial?.vendor_name ?? '')
  const [cost,        setCost]        = useState<number | ''>(initial?.cost ?? '')
  const [mileage,     setMileage]     = useState<number | ''>(initial?.mileage_at_service ?? '')
  const [servicedAt,  setServicedAt]  = useState(initial?.serviced_at ?? today)
  const [nextDue,     setNextDue]     = useState(initial?.next_due_date ?? '')
  const [deductMonth, setDeductMonth] = useState(initial?.deduct_month?.slice(0, 7) ?? '')
  const [notes,       setNotes]       = useState(initial?.notes ?? '')

  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(initial?.receipt_url ?? null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [removeReceipt, setRemoveReceipt] = useState(false)

  function resetForm() {
    if (mode === 'create') {
      setVehicleId(''); setType(''); setVendorName(''); setCost('')
      setMileage(''); setServicedAt(today); setNextDue(''); setDeductMonth(''); setNotes('')
      setExistingReceiptUrl(null); setReceiptFile(null); setRemoveReceipt(false)
    } else {
      setReceiptFile(null); setRemoveReceipt(false)
    }
  }

  async function handleSubmit() {
    if (!vehicleId || !type.trim() || !servicedAt) return
    setSaving(true)

    let nextReceiptUrl: string | null = existingReceiptUrl
    if (removeReceipt) nextReceiptUrl = null

    if (receiptFile) {
      const fd = new FormData()
      fd.append('file', receiptFile)
      const up = await uploadReceipt(fd)
      if (up.error) {
        setSaving(false)
        alert(`單據上傳失敗：${up.error}`)
        return
      }
      nextReceiptUrl = up.url
    }

    const payload: MaintenanceInput = {
      vehicle_id:         vehicleId,
      type:               type.trim(),
      vendor_name:        vendorName.trim() || null,
      cost:               cost === '' ? null : Number(cost),
      mileage_at_service: mileage === '' ? null : Number(mileage),
      serviced_at:        servicedAt,
      next_due_date:      nextDue || null,
      deduct_month:       deductMonth ? `${deductMonth}-01` : null,
      notes:              notes.trim() || null,
      receipt_url:        nextReceiptUrl,
    }

    const { error } = mode === 'create'
      ? await createMaintenanceLog(payload)
      : await updateMaintenanceLog(initial!.id, payload, initial?.receipt_url ?? null)
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); resetForm(); router.refresh()
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }

  const defaultTrigger = mode === 'create'
    ? <button className="btn btn-primary" onClick={() => setOpen(true)} title="新增保養" style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px' }}><Plus size={16} /></button>
    : <button className="icon-btn" onClick={() => setOpen(true)} title="編輯"><PencilLine size={14} /></button>

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
            borderRadius: 14, width: '100%', maxWidth: 560,
            padding: '28px 28px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {mode === 'create' ? '新增保養紀錄' : '編輯保養紀錄'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>車輛</span>
                <select className="input" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                  <option value="">— 選擇車輛 —</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
                </select>
              </label>
              <label style={L}>
                <span style={LT}>類型</span>
                <input
                  type="text" className="input" value={type}
                  onChange={e => setType(e.target.value)} placeholder="例：定期保養、輪胎更換"
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>保養日期</span>
                <input type="date" className="input" value={servicedAt} onChange={e => setServicedAt(e.target.value)} />
              </label>
              <label style={L}>
                <span style={LT}>下次預定日</span>
                <input type="date" className="input" value={nextDue} onChange={e => setNextDue(e.target.value)} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>保養廠商</span>
                <input
                  type="text" className="input" value={vendorName}
                  list="maintenance-vendors"
                  onChange={e => setVendorName(e.target.value)} placeholder="例：永豐汽車保養廠"
                />
                <datalist id="maintenance-vendors">
                  {vendorNames.map(n => <option key={n} value={n} />)}
                </datalist>
              </label>
              <label style={L}>
                <span style={LT}>費用 (NT$)</span>
                <input
                  type="number" className="input" min={0} value={cost}
                  onChange={e => setCost(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
            </div>

            <label style={L}>
              <span style={LT}>當下里程 (km)</span>
              <input
                type="number" className="input" min={0} value={mileage}
                onChange={e => setMileage(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>扣款年月（選填）</span>
                <input
                  type="month" className="input" value={deductMonth}
                  onChange={e => setDeductMonth(e.target.value)}
                />
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>實際在幾月運費中扣除；空白則用保養日期當月</span>
              </label>
              <label style={L}>
                <span style={LT}>備註</span>
                <input
                  type="text" className="input" value={notes}
                  onChange={e => setNotes(e.target.value)} placeholder="選填"
                />
              </label>
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
                disabled={!vehicleId || !type.trim() || !servicedAt || saving}
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
