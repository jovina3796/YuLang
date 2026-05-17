'use client'
import { useEffect, useState } from 'react'
import liff from '@line/liff'

type Vehicle = { id: string; plate_number: string }
type Config = {
  driver: { id: string; name: string }
  vehicles: Vehicle[]
  resolvedVehicleId: string | null
  paymentSuggestions: string[]
}

export default function FuelLiffPage() {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID

  const [stage, setStage] = useState<'init' | 'ready' | 'submitting' | 'done' | 'error'>('init')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [vehicleId, setVehicleId] = useState('')
  const [mileage, setMileage] = useState('')
  const [total, setTotal] = useState('')
  const [payment, setPayment] = useState('')
  const [notes, setNotes] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)

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

        const res = await fetch('/api/line/fuel/config', {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !vehicleId || !total) return
    setStage('submitting')
    try {
      const fd = new FormData()
      fd.append('logged_at', date)
      fd.append('vehicle_id', vehicleId)
      fd.append('total_cost', total)
      if (mileage) fd.append('mileage_at_refuel', mileage)
      if (payment) fd.append('payment_method', payment)
      if (notes)   fd.append('notes', notes)
      if (receipt) fd.append('receipt', receipt)

      const res = await fetch('/api/line/fuel', {
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

  if (stage === 'init') {
    return <Centered>載入中…</Centered>
  }
  if (stage === 'error') {
    return <Centered><div style={{ color: '#c00', textAlign: 'center', lineHeight: 1.6 }}>{errorMsg}</div></Centered>
  }
  if (stage === 'done') {
    return <Centered><div style={{ color: '#2E7D32', fontSize: 18, fontWeight: 700 }}>加油資料已記錄 ✓</div></Centered>
  }
  if (!config) return null

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>加油回報</div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>司機：{config.driver.name}</div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="日期">
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

        <Field label="目前里程 (km)">
          <input type="number" min={0} inputMode="numeric" value={mileage}
                 onChange={e => setMileage(e.target.value)} style={inputStyle} placeholder="會同步至車輛里程" />
        </Field>

        <Field label="金額 (NT$) *">
          <input type="number" min={1} required inputMode="numeric" value={total}
                 onChange={e => setTotal(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="付款方式">
          <input type="text" value={payment} onChange={e => setPayment(e.target.value)}
                 list="payment-options" style={inputStyle} placeholder="可輸入別名，例：阿哲卡" />
          <datalist id="payment-options">
            {config.paymentSuggestions.map(p => <option key={p} value={p} />)}
          </datalist>
        </Field>

        <Field label="備註">
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="收據（選填）">
          <input type="file" accept="image/*,application/pdf"
                 onChange={e => setReceipt(e.target.files?.[0] ?? null)} />
          {receipt && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>已選：{receipt.name}</div>}
        </Field>

        <button type="submit" disabled={stage === 'submitting' || !vehicleId || !total} style={submitStyle}>
          {stage === 'submitting' ? '送出中…' : '送出'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: '#555' }}>{label}</span>
      {children}
    </label>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #ddd', borderRadius: 8, padding: '10px 12px',
  fontSize: 16, width: '100%', boxSizing: 'border-box',
}

const submitStyle: React.CSSProperties = {
  background: '#2E7D32', color: 'white', border: 'none', borderRadius: 10,
  padding: '14px 16px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
  marginTop: 8,
}
