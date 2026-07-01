'use client'
import { useEffect, useState } from 'react'
import liff from '@line/liff'

type Vehicle = { id: string; plate_number: string }
type Config = {
  driver: { id: string; name: string }
  vehicles: Vehicle[]
  resolvedVehicleId: string | null
}

const COMMON_CATEGORIES = ['停車費', '過路費', '罰單', '車輛用品', '辦公用品', '雜支', '其他']

export default function MiscLiffPage() {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID // 確保你的 .env 有設定這個變數

  const [stage, setStage] = useState<'init' | 'ready' | 'submitting' | 'done' | 'error'>('init')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [vehicleId, setVehicleId] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
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

        const res = await fetch('/api/line/misc/config', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          if (res.status === 403 && body.error === 'driver_not_bound') {
            setErrorMsg('此 LINE 帳號尚未綁定司機，請先在 LINE 對 Bot 輸入「電話 姓名」綁定。')
          } else {
            setErrorMsg(`載入設定失敗（${res.status}）`)
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
    if (!accessToken || !amount) return
    setStage('submitting')
    try {
      const fd = new FormData()
      fd.append('transaction_date', date)
      fd.append('type', type)
      fd.append('amount', amount)
      if (vehicleId) fd.append('vehicle_id', vehicleId)
      if (category) fd.append('category', category)
      if (description) fd.append('description', description)
      if (notes) fd.append('notes', notes)
      if (receipt) fd.append('receipt', receipt)

      const res = await fetch('/api/line/misc', {
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
  if (stage === 'done') return <Centered><div style={{ color: '#2E7D32', fontSize: 18, fontWeight: 700 }}>收支資料已記錄 ✓</div></Centered>
  if (!config) return null

  return (
    <div style={{ minHeight: '100vh', background: '#bac6d4', color: '#000', padding: '16px 0' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#000' }}>其他收支回報</div>
        <div style={{ fontSize: 12, color: '#2d3a52', marginBottom: 16 }}>司機：{config.driver.name}</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="類型 *">
              <select required value={type} onChange={e => setType(e.target.value as 'expense' | 'income')} style={inputStyle}>
                <option value="expense">支出 (墊付)</option>
                <option value="income">收入</option>
              </select>
            </Field>
            <Field label="日期 *">
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <Field label="車輛 (選填)">
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} style={inputStyle}>
              <option value="">— 不綁定車輛 —</option>
              {config.vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.plate_number}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: '#2d3a52', marginTop: '-4px' }}>若為個人公費可不選車輛</div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="類別">
              <input type="text" value={category} onChange={e => setCategory(e.target.value)}
                     list="category-suggestions" style={inputStyle} placeholder="例：停車費" />
              <datalist id="category-suggestions">
                {COMMON_CATEGORIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="金額 (NT$) *">
              <input type="number" min={1} required inputMode="numeric" value={amount}
                     onChange={e => setAmount(e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <Field label="說明 (選填)">
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} placeholder="例：三重中山站停車" />
          </Field>

          <Field label="單據照片 (選填)">
            <label style={fileBtnStyle}>
              {receipt ? '更換照片' : '選擇照片 / 拍照'}
              <input type="file" accept="image/*,application/pdf"
                     onChange={e => setReceipt(e.target.files?.[0] ?? null)}
                     style={{ display: 'none' }} />
            </label>
            {receipt && <div style={{ fontSize: 11, color: '#2d3a52', marginTop: 6 }}>已選：{receipt.name}</div>}
          </Field>

          <Field label="備註 (選填)">
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} />
          </Field>

          <button type="submit" disabled={stage === 'submitting' || !amount} style={submitStyle}>
            {stage === 'submitting' ? '送出中…' : '送出報帳'}
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

const fileBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: '#2d3a52', color: '#ffffff', border: 'none', borderRadius: 8,
  padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  alignSelf: 'flex-start',
}

const submitStyle: React.CSSProperties = {
  background: '#2E7D32', color: 'white', border: 'none', borderRadius: 10,
  padding: '14px 16px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
  marginTop: 8,
}
