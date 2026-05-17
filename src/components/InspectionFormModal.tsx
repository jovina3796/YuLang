'use client'
import { useState } from 'react'
import { PencilLine, Paperclip, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  createInspectionLog, updateInspectionLog, uploadInspectionFile,
  type InspectionInput,
} from '@/app/(dashboard)/inspection/actions'

type Vehicle = { id: string; plate_number: string; manufacture_date?: string | null }

export type InspectionRow = {
  id:                 string
  vehicle_id:         string
  inspected_at:       string
  result:             string | null
  fee:                number | null
  vendor_name:        string | null
  mileage_at_service: number | null
  next_due_date:      string | null
  license_url:        string | null
  receipt_url:        string | null
  deduct_month:       string | null
  notes:              string | null
}

interface Props {
  vehicles: Vehicle[]
  mode:     'create' | 'edit'
  initial?: InspectionRow
  trigger?: React.ReactNode
}

function computeNextDue(manufactureDate: string | null | undefined, inspectedAt: string): string {
  const inspected = new Date(inspectedAt)
  const manufacture = manufactureDate ? new Date(manufactureDate) : null
  const ageYears = manufacture ? (Date.now() - manufacture.getTime()) / (365.25 * 86400000) : 0
  const monthsToAdd = !manufacture || ageYears < 5 ? 12 : 6
  const next = new Date(inspected)
  next.setMonth(next.getMonth() + monthsToAdd)
  return next.toISOString().split('T')[0]
}

export default function InspectionFormModal({ vehicles, mode, initial, trigger }: Props) {
  const router = useRouter()
  const today  = new Date().toISOString().split('T')[0]

  const [open,         setOpen]         = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [vehicleId,    setVehicleId]    = useState(initial?.vehicle_id ?? '')
  const [inspectedAt,  setInspectedAt]  = useState(initial?.inspected_at ?? today)
  const [result,       setResult]       = useState(initial?.result ?? '通過')
  const [fee,          setFee]          = useState<number | ''>(initial?.fee ?? '')
  const [vendorName,   setVendorName]   = useState(initial?.vendor_name ?? '')
  const [mileage,      setMileage]      = useState<number | ''>(initial?.mileage_at_service ?? '')
  const [nextDue,      setNextDue]      = useState(initial?.next_due_date ?? '')
  const [deductMonth,  setDeductMonth]  = useState(initial?.deduct_month?.slice(0, 7) ?? '')
  const [notes,        setNotes]        = useState(initial?.notes ?? '')

  const [existingLicense, setExistingLicense] = useState<string | null>(initial?.license_url ?? null)
  const [licenseFile,     setLicenseFile]     = useState<File | null>(null)
  const [removeLicense,   setRemoveLicense]   = useState(false)

  const [existingReceipt, setExistingReceipt] = useState<string | null>(initial?.receipt_url ?? null)
  const [receiptFile,     setReceiptFile]     = useState<File | null>(null)
  const [removeReceipt,   setRemoveReceipt]   = useState(false)

  function autofillNextDue() {
    if (!vehicleId || !inspectedAt) return
    const v = vehicles.find(x => x.id === vehicleId)
    setNextDue(computeNextDue(v?.manufacture_date ?? null, inspectedAt))
  }

  function resetForm() {
    if (mode === 'create') {
      setVehicleId(''); setInspectedAt(today); setResult('通過')
      setFee(''); setVendorName(''); setMileage(''); setNextDue('')
      setDeductMonth(''); setNotes('')
      setExistingLicense(null); setLicenseFile(null); setRemoveLicense(false)
      setExistingReceipt(null); setReceiptFile(null); setRemoveReceipt(false)
    } else {
      setLicenseFile(null); setRemoveLicense(false)
      setReceiptFile(null); setRemoveReceipt(false)
    }
  }

  async function uploadOne(file: File): Promise<{ url: string | null; error: string | null }> {
    const fd = new FormData()
    fd.append('file', file)
    return uploadInspectionFile(fd)
  }

  async function handleSubmit() {
    if (!vehicleId || !inspectedAt) return
    setSaving(true)

    let nextLicenseUrl: string | null = existingLicense
    if (removeLicense) nextLicenseUrl = null
    if (licenseFile) {
      const up = await uploadOne(licenseFile)
      if (up.error) { setSaving(false); alert(`行照上傳失敗：${up.error}`); return }
      nextLicenseUrl = up.url
    }

    let nextReceiptUrl: string | null = existingReceipt
    if (removeReceipt) nextReceiptUrl = null
    if (receiptFile) {
      const up = await uploadOne(receiptFile)
      if (up.error) { setSaving(false); alert(`收據上傳失敗：${up.error}`); return }
      nextReceiptUrl = up.url
    }

    const payload: InspectionInput = {
      vehicle_id:         vehicleId,
      inspected_at:       inspectedAt,
      result:             result.trim() || null,
      fee:                fee === '' ? null : Number(fee),
      vendor_name:        vendorName.trim() || null,
      mileage_at_service: mileage === '' ? null : Number(mileage),
      next_due_date:      nextDue || null,
      license_url:        nextLicenseUrl,
      receipt_url:        nextReceiptUrl,
      deduct_month:       deductMonth ? `${deductMonth}-01` : null,
      notes:              notes.trim() || null,
    }

    const { error } = mode === 'create'
      ? await createInspectionLog(payload)
      : await updateInspectionLog(initial!.id, payload, initial?.license_url ?? null, initial?.receipt_url ?? null)
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); resetForm(); router.refresh()
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }

  const defaultTrigger = mode === 'create'
    ? <button className="btn btn-primary" onClick={() => setOpen(true)} title="新增驗車紀錄" style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px' }}><Plus size={16} /></button>
    : <button className="icon-btn" onClick={() => setOpen(true)} title="編輯"><PencilLine size={14} /></button>

  function FilePicker({
    label, existing, file, removed, setRemoved, setFile,
  }: {
    label: string
    existing: string | null
    file: File | null
    removed: boolean
    setRemoved: (b: boolean) => void
    setFile: (f: File | null) => void
  }) {
    const showExisting = mode === 'edit' && existing && !removed && !file
    return (
      <div style={{ ...L, gap: 8 }}>
        <span style={LT}>{label}</span>
        {showExisting && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 12px',
          }}>
            <a href={existing!} target="_blank" rel="noopener noreferrer"
               style={{ color: 'var(--blue)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Paperclip size={13} /> 已上傳（點此預覽）
            </a>
            <button type="button" className="btn btn-sm" style={{ color: 'var(--red)' }} onClick={() => setRemoved(true)}>移除</button>
          </div>
        )}
        {mode === 'edit' && removed && !file && (
          <div style={{ fontSize: 12, color: 'var(--amber2)' }}>
            ⚠ 儲存後將刪除原檔
            <button type="button" className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => setRemoved(false)}>取消移除</button>
          </div>
        )}
        <label className="btn btn-sm" style={{ cursor: 'pointer', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Paperclip size={13} />選擇檔案
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            style={{ display: 'none' }}
          />
        </label>
        {file && (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
            將上傳：{file.name}（{(file.size / 1024).toFixed(0)} KB）
            {existing && !removed && '（會取代原檔）'}
          </span>
        )}
      </div>
    )
  }

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
            borderRadius: 14, width: '100%', maxWidth: 640,
            padding: '28px 28px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {mode === 'create' ? '新增驗車紀錄' : '編輯驗車紀錄'}
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
                <span style={LT}>驗車日期</span>
                <input type="date" className="input" value={inspectedAt} onChange={e => setInspectedAt(e.target.value)} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>驗車結果</span>
                <select className="input" value={result} onChange={e => setResult(e.target.value)}>
                  <option value="通過">通過</option>
                  <option value="複驗">複驗</option>
                  <option value="不合格">不合格</option>
                </select>
              </label>
              <label style={L}>
                <span style={LT}>下次驗車日期</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="date" className="input" style={{ flex: 1 }}
                         value={nextDue} onChange={e => setNextDue(e.target.value)} />
                  <button type="button" className="btn btn-sm" onClick={autofillNextDue} title="依出廠年月與驗車日期自動計算">自動</button>
                </div>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>檢驗廠商</span>
                <input
                  type="text" className="input" value={vendorName}
                  onChange={e => setVendorName(e.target.value)} placeholder="例：監理站／民間代檢"
                />
              </label>
              <label style={L}>
                <span style={LT}>費用 (NT$)</span>
                <input
                  type="number" className="input" min={0} value={fee}
                  onChange={e => setFee(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>當下里程 (km)</span>
                <input
                  type="number" className="input" min={0} value={mileage}
                  onChange={e => setMileage(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label style={L}>
                <span style={LT}>扣款年月（選填）</span>
                <input
                  type="month" className="input" value={deductMonth}
                  onChange={e => setDeductMonth(e.target.value)}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FilePicker
                label="行照（圖片 / PDF，選填）"
                existing={existingLicense}
                file={licenseFile}
                removed={removeLicense}
                setRemoved={setRemoveLicense}
                setFile={setLicenseFile}
              />
              <FilePicker
                label="收據（圖片 / PDF，選填）"
                existing={existingReceipt}
                file={receiptFile}
                removed={removeReceipt}
                setRemoved={setRemoveReceipt}
                setFile={setReceiptFile}
              />
            </div>

            <label style={L}>
              <span style={LT}>備註</span>
              <input
                type="text" className="input" value={notes}
                onChange={e => setNotes(e.target.value)} placeholder="選填"
              />
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={() => { setOpen(false); resetForm() }}>取消</button>
              <button
                className="btn btn-primary"
                disabled={!vehicleId || !inspectedAt || saving}
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
