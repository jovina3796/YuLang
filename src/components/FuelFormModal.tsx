'use client'
import { useState } from 'react'
import { PencilLine, Plus, Paperclip } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createFuelLog, updateFuelLog, uploadFuelReceipt, type FuelInput } from '@/app/(dashboard)/fuel/actions'

type Vehicle = { id: string; plate_number: string }

export type FuelRow = {
  id:                string
  vehicle_id:        string
  driver_id:         string | null
  liters:            number | null
  price_per_liter:   number | null
  total_cost:        number | null
  mileage_at_refuel: number | null
  station_name:      string | null
  payment_method:    string | null
  notes:             string | null
  logged_at:         string
  receipt_url:       string | null
}

interface Props {
  vehicles: Vehicle[]
  mode:     'create' | 'edit'
  initial?: FuelRow
  trigger?: React.ReactNode
}

export default function FuelFormModal({ vehicles, mode, initial, trigger }: Props) {
  const router = useRouter()
  const today  = new Date().toISOString().split('T')[0]

  const [open,      setOpen]      = useState(false)
  const [saving,    setSaving]    = useState(false)

  const initialDate = initial?.logged_at ? initial.logged_at.split('T')[0] : today

  const [date,      setDate]      = useState(initialDate)
  const [vehicleId, setVehicleId] = useState(initial?.vehicle_id ?? '')
  const [mileage,   setMileage]   = useState<number | ''>(initial?.mileage_at_refuel ?? '')
  const [totalCost, setTotalCost] = useState<number | ''>(initial?.total_cost ?? '')
  const [payMethod, setPayMethod] = useState(initial?.payment_method ?? '')
  const [notes,     setNotes]     = useState(initial?.notes ?? '')

  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(initial?.receipt_url ?? null)
  const [receiptFile,   setReceiptFile]   = useState<File | null>(null)
  const [removeReceipt, setRemoveReceipt] = useState(false)

  function resetForm() {
    if (mode === 'create') {
      setDate(today); setVehicleId(''); setMileage(''); setTotalCost(''); setPayMethod(''); setNotes('')
      setExistingReceiptUrl(null); setReceiptFile(null); setRemoveReceipt(false)
    } else {
      setReceiptFile(null); setRemoveReceipt(false)
    }
  }

  async function handleSubmit() {
    if (!vehicleId || totalCost === '') return
    setSaving(true)

    let nextUrl: string | null = existingReceiptUrl
    if (removeReceipt) nextUrl = null
    if (receiptFile) {
      const fd = new FormData()
      fd.append('file', receiptFile)
      const up = await uploadFuelReceipt(fd)
      if (up.error) { setSaving(false); alert(`單據上傳失敗：${up.error}`); return }
      nextUrl = up.url
    }

    const payload: FuelInput = {
      vehicle_id:        vehicleId,
      driver_id:         initial?.driver_id ?? null,
      liters:            initial?.liters ?? null,
      price_per_liter:   initial?.price_per_liter ?? null,
      total_cost:        Number(totalCost),
      mileage_at_refuel: mileage === '' ? null : Number(mileage),
      station_name:      initial?.station_name ?? null,
      payment_method:    payMethod.trim() || null,
      notes:             notes.trim() || null,
      logged_at:         new Date(`${date}T00:00:00+08:00`).toISOString(),
      receipt_url:       nextUrl,
    }
    const { error } = mode === 'create'
      ? await createFuelLog(payload)
      : await updateFuelLog(initial!.id, payload)
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); resetForm(); router.refresh()
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }

  const defaultTrigger = mode === 'create'
    ? <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)} title="新增" style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px' }}><Plus size={14} /></button>
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
            borderRadius: 14, width: '100%', maxWidth: 500,
            padding: '28px 28px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {mode === 'create' ? '新增加油紀錄' : '編輯加油紀錄'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>日期</span>
                <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
              </label>
              <label style={L}>
                <span style={LT}>車輛</span>
                <select className="input" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                  <option value="">— 選擇車輛 —</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>目前里程 (km)</span>
                <input
                  type="number" className="input" min={0} value={mileage}
                  onChange={e => setMileage(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="會同步至車輛里程"
                />
              </label>
              <label style={L}>
                <span style={LT}>金額 (NT$)</span>
                <input
                  type="number" className="input" min={0} value={totalCost}
                  onChange={e => setTotalCost(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
            </div>

            <label style={L}>
              <span style={LT}>付款方式</span>
              <input
                type="text" className="input" value={payMethod}
                onChange={e => setPayMethod(e.target.value)}
                placeholder="例：現金、公司簽單、信用卡"
                list="fuel-payment-methods"
              />
              <datalist id="fuel-payment-methods">
                <option value="現金" />
                <option value="公司簽單" />
                <option value="信用卡" />
              </datalist>
            </label>

            <label style={L}>
              <span style={LT}>備註</span>
              <input
                type="text" className="input" value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="選填"
              />
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
              <button className="btn" onClick={() => { setOpen(false); resetForm() }}>取消</button>
              <button
                className="btn btn-primary"
                disabled={!vehicleId || totalCost === '' || saving}
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
