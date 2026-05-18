'use client'
import { useEffect, useState } from 'react'
import liff from '@line/liff'

type Vehicle = { id: string; plate_number: string; mileage: number | null }
type Config = {
  driver: { id: string; name: string }
  vehicles: Vehicle[]
  vendorSuggestions: string[]
  resolvedVehicleId: string | null
}

type AiParsed = {
  type:               string | null
  vendor_name:        string | null
  cost:               number | null
  mileage_at_service: number | null
  serviced_at:        string | null
  next_due_date:      string | null
  notes:              string | null
}

export default function MaintenanceLiffPage() {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID_MAINTENANCE || process.env.NEXT_PUBLIC_LIFF_ID

  const [stage, setStage] = useState<'init' | 'ready' | 'submitting' | 'done' | 'error'>('init')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate]               = useState(today)
  const [vehicleId, setVehicleId]     = useState('')
  const [type, setType]               = useState('')
  const [vendorName, setVendorName]   = useState('')
  const [cost, setCost]               = useState('')
  const [mileage, setMileage]         = useState('')
  const [nextDue, setNextDue]         = useState('')
  const [notes, setNotes]             = useState('')
  const [receipt, setReceipt]         = useState<File | null>(null)

  const [aiBusy, setAiBusy] = useState(false)
  const [aiNote, setAiNote] = useState<string | null>(null)

  useEffect(() => {
    if (!liffId) { setErrorMsg('LIFF ID 未設定，請聯絡管理員。'); setStage('error'); return }
    let alive = true
    ;(async () => {
      try {
        await liff.init({ liffId })
        if (!alive) return
        if (!liff.isLoggedIn()) { liff.login(); return }
        const token = liff.getAccessToken()
        if (!token) { setErrorMsg('無法取得授權，請重新開啟。'); setStage('error'); return }
        setAccessToken(token)

        const res = await fetch('/api/line/maintenance/config', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          if (res.status === 403 && body.error === 'driver_not_bound') {
            setErrorMsg('此 LINE 帳號尚未綁定司機，請先在 LINE 對 Bot 輸入「電話 姓名」綁定。')
          } else {
            setErrorMsg(`載入失敗（${res.status}）`)
          }
          setStage('error')
          return
        }
        const cfg = await res.json() as Config
        if (!alive) return
        setConfig(cfg)
        setVehicleId(cfg.resolvedVehicleId ?? '')
        setStage('ready')
      } catch (e) {
        if (!alive) return
        console.error(e)
        setErrorMsg('初始化失敗：' + (e instanceof Error ? e.message : String(e)))
        setStage('error')
      }
    })()
    return () => { alive = false }
  }, [liffId])

  async function handleAiParse(file: File) {
    if (!accessToken) return
    setAiBusy(true); setAiNote(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/line/maintenance/parse', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setAiNote(`AI 辨識失敗：${body.detail ?? body.error ?? res.status}（仍可手動填寫送出）`)
        return
      }
      const { parsed } = await res.json() as { parsed: AiParsed }
      // Fill empty fields only — don't overwrite user input
      if (parsed.type        && !type)        setType(parsed.type)
      if (parsed.vendor_name && !vendorName)  setVendorName(parsed.vendor_name)
      if (parsed.cost != null && !cost)       setCost(String(parsed.cost))
      if (parsed.mileage_at_service != null && !mileage) setMileage(String(parsed.mileage_at_service))
      if (parsed.serviced_at && date === today) setDate(parsed.serviced_at)
      if (parsed.next_due_date && !nextDue)   setNextDue(parsed.next_due_date)
      if (parsed.notes       && !notes)       setNotes(parsed.notes)
      const filled = ['type', 'vendor_name', 'cost', 'mileage_at_service', 'serviced_at', 'next_due_date', 'notes']
        .filter(k => (parsed as Record<string, unknown>)[k] != null).length
      setAiNote(filled > 0 ? `✓ AI 已自動填入 ${filled} 個欄位，請確認後送出` : 'AI 未辨識到關鍵資訊，請手動填寫')
    } catch (e) {
      setAiNote('AI 辨識失敗：' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setAiBusy(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setReceipt(f)
    if (f) handleAiParse(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !vehicleId || !type.trim()) return
    setStage('submitting')
    try {
      const fd = new FormData()
      fd.append('serviced_at', date)
      fd.append('vehicle_id', vehicleId)
      fd.append('type', type)
      if (vendorName) fd.append('vendor_name', vendorName)
      if (cost)       fd.append('cost', cost)
      if (mileage)    fd.append('mileage_at_service', mileage)
      if (nextDue)    fd.append('next_due_date', nextDue)
      if (notes)      fd.append('notes', notes)
      if (receipt)    fd.append('receipt', receipt)

      const res = await fetch('/api/line/maintenance', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErrorMsg(`送出失敗：${body.error ?? res.status}${body.detail ? ` - ${body.detail}` : ''}`)
        setStage('error')
        return
      }
      setStage('done')
      setTimeout(() => { try { liff.closeWindow() } catch {} }, 1200)
    } catch (e) {
      setErrorMsg('送出失敗：' + (e instanceof Error ? e.message : String(e)))
      setStage('error')
    }
  }

  if (stage === 'init') return <Centered>載入中…</Centered>
  if (stage === 'error') return <Centered><div style={{ color: '#c00', textAlign: 'center', lineHeight: 1.6 }}>{errorMsg}</div></Centered>
  if (stage === 'done') return <Centered><div style={{ color: '#2E7D32', fontSize: 18, fontWeight: 700 }}>維修保養已記錄 ✓</div></Centered>
  if (!config) return null

  return (
    <div style={{ minHeight: '100vh', background: '#bac6d4', color: '#000', padding: '16px 0' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#000' }}>維修保養回報</div>
        <div style={{ fontSize: 12, color: '#2d3a52', marginBottom: 16 }}>司機：{config.driver.name}</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="維修單據（照片 / PDF；上傳後 AI 自動辨識）">
            <label style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: '#2d3a52', color: '#ffffff', border: 'none', borderRadius: 8,
              padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              alignSelf: 'flex-start',
            }}>
              {receipt ? '更換檔案' : '選擇檔案'}
              <input type="file" accept="image/*,application/pdf"
                     onChange={handleFileChange}
                     style={{ display: 'none' }} />
            </label>
            {receipt && <div style={{ fontSize: 11, color: '#2d3a52', marginTop: 6 }}>已選：{receipt.name}</div>}
            {aiBusy && <div style={{ fontSize: 12, color: '#2E7D32', marginTop: 6 }}>AI 辨識中…</div>}
            {aiNote && !aiBusy && <div style={{ fontSize: 12, color: aiNote.startsWith('✓') ? '#2E7D32' : '#c00', marginTop: 6 }}>{aiNote}</div>}
          </Field>

          <Field label="日期 *">
            <input type="date" required value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="車輛 *">
            <select required value={vehicleId} onChange={e => setVehicleId(e.target.value)} style={inputStyle}>
              <option value="">— 選擇車輛 —</option>
              {config.vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.plate_number}</option>
              ))}
            </select>
          </Field>

          <Field label="維修項目 *">
            <input type="text" required value={type} onChange={e => setType(e.target.value)}
                   placeholder="例：定期保養、輪胎更換" style={inputStyle} />
          </Field>

          <Field label="廠商">
            <input type="text" value={vendorName} onChange={e => setVendorName(e.target.value)}
                   list="vendor-suggestions" style={inputStyle} placeholder="例：誠新汽車" />
            <datalist id="vendor-suggestions">
              {config.vendorSuggestions.map(v => <option key={v} value={v} />)}
            </datalist>
          </Field>

          <Field label="金額 (NT$)">
            <input type="number" min={0} inputMode="numeric" value={cost}
                   onChange={e => setCost(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="維修當下里程 (km)">
            <input type="number" min={0} inputMode="numeric" value={mileage}
                   onChange={e => setMileage(e.target.value)} style={inputStyle}
                   placeholder="會同步更新車輛里程" />
          </Field>

          <Field label="下次保養日期">
            <input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="備註">
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} />
          </Field>

          <button type="submit"
                  disabled={stage === 'submitting' || !vehicleId || !type.trim() || aiBusy}
                  style={submitStyle}>
            {stage === 'submitting' ? '送出中…' : '送出'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: '#000', fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#bac6d4', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #9aa6b8', borderRadius: 8, padding: '10px 12px',
  fontSize: 16, width: '100%', boxSizing: 'border-box',
  background: '#ffffff', color: '#000',
}

const submitStyle: React.CSSProperties = {
  background: '#2E7D32', color: 'white', border: 'none', borderRadius: 10,
  padding: '14px 16px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
  marginTop: 8,
}
