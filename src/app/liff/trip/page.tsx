'use client'
import { useEffect, useMemo, useState } from 'react'
import liff from '@line/liff'

type Vehicle = { id: string; plate_number: string }
type Vendor  = { id: string; name: string; warehouse: string | null }
type RateRule = {
  id: string
  vendor_id: string
  service_type: string
  destination_area: string | null
  base_trips: number | null
  base_fare: number | null
  kpi_fare: number | null
  base_stops: number | null
  surcharge_per_stop: number | null
  pricing_mode: string
  special_rate: number | null
  special_rate_note: string | null
  is_service_default: boolean
  display_order: number | null
}
type AliasRow = { alias: string; billing_area: string }
// 🌟 1. 新增 Surcharge 型別
type Surcharge = { id: string; vendor_id: string; name: string; rate: number }

type Config = {
  driver: { id: string; name: string }
  vehicles: Vehicle[]
  vendors: Vendor[]
  rateRules: RateRule[]
  aliases: AliasRow[]
  resolvedVehicleId: string | null
  surcharges: Surcharge[] // 🌟 2. 將 surcharges 放入 Config 中
}

// 🌟 3. 更新運費計算邏輯，將特殊加成的固定金額 (surchargeRate) 加上去
function calcFare(rule: RateRule, tripCount: number, stops: number, isKpi: boolean, isSpecial: boolean, surchargeRate: number = 0): number {
  let fare = 0
  const bundle  = Math.max(1, rule.base_trips ?? 1)
  const bundles = Math.ceil(tripCount / bundle)
  switch (rule.pricing_mode) {
    case 'flat':
      fare = (rule.base_fare ?? 0) * bundles; break
    case 'base_or_kpi': {
      const base  = isKpi ? (rule.kpi_fare ?? rule.base_fare ?? 0) : (rule.base_fare ?? 0)
      const extra = stops > (rule.base_stops ?? 0)
        ? (stops - (rule.base_stops ?? 0)) * (rule.surcharge_per_stop ?? 0) : 0
      fare = base * bundles + extra; break
    }
    case 'per_stop_count':
      fare = stops * (rule.surcharge_per_stop ?? 0); break
    case 'pure_surcharge':
      fare = ((rule.base_fare ?? 0) + stops * (rule.surcharge_per_stop ?? 0)) * bundles; break
  }
  if (isSpecial && rule.special_rate) fare = fare * (1 + rule.special_rate)
  
  return Math.round(fare) + surchargeRate // 🌟 加上特殊加成費用
}

export default function TripLiffPage() {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TRIP || process.env.NEXT_PUBLIC_LIFF_ID

  const [stage, setStage] = useState<'init' | 'ready' | 'submitting' | 'done' | 'error'>('init')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate]                 = useState(today)
  const [vehicleId, setVehicleId]       = useState('')
  const [svcType, setSvcType]           = useState('')
  const [vendorId, setVendorId]         = useState('')
  const [area, setArea]                 = useState('')
  const [deliveryArea, setDeliveryArea] = useState('')
  const [tripCount, setTripCount]       = useState(1)
  const [actualStops, setActualStops]   = useState<string>('')
  const [isKpi, setIsKpi]               = useState(true)
  const [isSpecial, setIsSpecial]       = useState(false)
  const [notes, setNotes]               = useState('')
  const [surchargeId, setSurchargeId]   = useState('') // 🌟 4. 新增選擇特殊加成的 State

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

        const res = await fetch('/api/line/trip/config', {
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

  const serviceTypes = useMemo(() => {
    if (!config) return []
    const seen = new Set<string>()
    const out: string[] = []
    for (const r of config.rateRules) {
      if (!seen.has(r.service_type)) { seen.add(r.service_type); out.push(r.service_type) }
    }
    return out
  }, [config])

  const svcRules = useMemo(() => {
    if (!config || !svcType) return []
    return config.rateRules.filter(r => r.service_type === svcType)
  }, [config, svcType])

  const svcVendors = useMemo(() => {
    if (!config) return []
    const ids = new Set(svcRules.map(r => r.vendor_id))
    return config.vendors.filter(v => ids.has(v.id))
  }, [config, svcRules])

  const showVendorPicker = svcVendors.length > 1

  const availableAreas = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const r of svcRules) {
      if (vendorId && r.vendor_id !== vendorId) continue
      if (r.destination_area && !seen.has(r.destination_area)) {
        seen.add(r.destination_area); out.push(r.destination_area)
      }
    }
    return out
  }, [svcRules, vendorId])

  const deliveryOptions = useMemo(() => {
    if (!config || !area) return []
    return config.aliases.filter(a => a.billing_area === area).map(a => a.alias)
  }, [config, area])

  const matchedRule = useMemo(() => {
    if (!svcType || !vendorId) return null
    return svcRules.find(r =>
      r.vendor_id === vendorId &&
      (availableAreas.length === 0 || r.destination_area === area),
    ) ?? null
  }, [svcRules, vendorId, area, availableAreas.length, svcType])

  // 🌟 5. 過濾出當前選擇廠商的特殊加成選項
  const vendorSurcharges = useMemo(() => {
    if (!config || !vendorId || !config.surcharges) return []
    return config.surcharges.filter(s => s.vendor_id === vendorId)
  }, [config, vendorId])

  // 取得當前選中的特殊加成物件
  const selectedSurcharge = vendorSurcharges.find(s => s.id === surchargeId)

  const stops      = actualStops === '' ? 0 : Number(actualStops)
  const isKpiBased = matchedRule?.pricing_mode === 'base_or_kpi'
  const isPerStop  = matchedRule?.pricing_mode === 'per_stop_count'
  const showStops  = !!matchedRule && (matchedRule.base_stops != null || matchedRule.surcharge_per_stop != null)
  const showSpecial = !!matchedRule?.special_rate
  
  // 🌟 將選中的特殊加成金額 (selectedSurcharge?.rate) 傳入運費計算中
  const autoFare   = matchedRule ? calcFare(matchedRule, tripCount, stops, isKpiBased ? isKpi : false, showSpecial && isSpecial, selectedSurcharge?.rate ?? 0) : null

  function applyService(s: string) {
    setSvcType(s)
    if (!config) return
    const rules = config.rateRules.filter(r => r.service_type === s)
    const def = rules.find(r => r.is_service_default) ?? rules[0]
    const newVendorId = def?.vendor_id ?? ''
    setVendorId(newVendorId)
    const vendorRules = rules.filter(r => r.vendor_id === newVendorId)
    const firstArea = vendorRules.find(r => r.destination_area)?.destination_area ?? ''
    setArea(firstArea)
    setDeliveryArea('')
    setTripCount(1); setActualStops(''); setIsKpi(true); setIsSpecial(false); setSurchargeId('') // 🌟 切換業務時重置選項
  }

  function applyVendor(vid: string) {
    setVendorId(vid)
    const vendorRules = svcRules.filter(r => r.vendor_id === vid)
    const firstArea = vendorRules.find(r => r.destination_area)?.destination_area ?? ''
    setArea(firstArea)
    setDeliveryArea('')
    setSurchargeId('') // 🌟 切換廠商時重置選項
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !vendorId || !matchedRule) return
    setStage('submitting')
    try {
      const res = await fetch('/api/line/trip', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logged_at:        date,
          vendor_id:        vendorId,
          rate_rule_id:     matchedRule.id,
          vehicle_id:       vehicleId || null,
          trip_count:       tripCount,
          actual_stops:     actualStops === '' ? null : Number(actualStops),
          is_kpi_achieved:  isKpiBased ? isKpi : null,
          is_special:       showSpecial ? isSpecial : false,
          destination_area: deliveryArea || null,
          surcharge_name:   selectedSurcharge ? selectedSurcharge.name : null, // 🌟 送出特殊加成名稱
          surcharge_rate:   selectedSurcharge ? selectedSurcharge.rate : null, // 🌟 送出特殊加成費用
          notes:            notes || null,
        }),
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
  if (stage === 'done') return <Centered><div style={{ color: '#2E7D32', fontSize: 18, fontWeight: 700 }}>車趟資料已記錄 ✓</div></Centered>
  if (!config) return null

  const stopsLabel = isPerStop ? '籃件數' : '店點數'
  const resolvedVehiclePlate = config.vehicles.find(v => v.id === vehicleId)?.plate_number ?? '未指定'

  return (
    <div style={{ minHeight: '100vh', background: '#bac6d4', color: '#000', padding: '16px 0' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#000' }}>車趟回報</div>
        <div style={{ fontSize: 12, color: '#2d3a52', marginBottom: 4 }}>司機：{config.driver.name}</div>
        <div style={{ fontSize: 12, color: '#2d3a52', marginBottom: 16 }}>車輛：{resolvedVehiclePlate}</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 日期、業務、廠商、區域等維持原樣 */}
          <Field label="日期">
            <input type="date" required value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="業務 *">
            <select required value={svcType} onChange={e => applyService(e.target.value)} style={inputStyle}>
              <option value="">— 選擇業務 —</option>
              {serviceTypes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          {showVendorPicker && (
            <Field label="廠商 *">
              <select required value={vendorId} onChange={e => applyVendor(e.target.value)} style={inputStyle}>
                {svcVendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.warehouse ? `／${v.warehouse}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {availableAreas.length > 1 && (
            <Field label="區域 *">
              <select required value={area} onChange={e => { setArea(e.target.value); setDeliveryArea('') }} style={inputStyle}>
                {availableAreas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
          )}

          {deliveryOptions.length > 0 && (
            <Field label="配送區域">
              <select value={deliveryArea} onChange={e => setDeliveryArea(e.target.value)} style={inputStyle}>
                <option value="">— 未指定 —</option>
                {deliveryOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
          )}

          <Field label="趟數 *">
            <input type="number" min={1} required inputMode="numeric" value={tripCount}
                   onChange={e => setTripCount(Math.max(1, Number(e.target.value) || 1))}
                   style={inputStyle} />
          </Field>

          {showStops && (
            <Field label={stopsLabel}>
              <input type="number" min={0} inputMode="numeric" value={actualStops}
                     onChange={e => setActualStops(e.target.value)} style={inputStyle} />
            </Field>
          )}

          {/* 🌟 新增：專屬的特殊加成下拉選單 (只有當該廠商有設定加成時才顯示) */}
          {vendorSurcharges.length > 0 && (
            <Field label="特殊加成 (選填)">
              <select value={surchargeId} onChange={e => setSurchargeId(e.target.value)} style={inputStyle}>
                <option value="">— 無 —</option>
                {vendorSurcharges.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (+{s.rate})</option>
                ))}
              </select>
            </Field>
          )}

          {isKpiBased && (
            <Field label="達標 KPI">
              <label style={checkRowStyle}>
                <input type="checkbox" checked={isKpi} onChange={e => setIsKpi(e.target.checked)} />
                <span>本趟達標</span>
              </label>
            </Field>
          )}

          {showSpecial && (
            <Field label={`特殊加成（${matchedRule?.special_rate_note ?? ''}）`}>
              <label style={checkRowStyle}>
                <input type="checkbox" checked={isSpecial} onChange={e => setIsSpecial(e.target.checked)} />
                <span>套用加成</span>
              </label>
            </Field>
          )}

          <Field label="備註">
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} />
          </Field>

          {autoFare != null && (
            <div style={{
              background: '#fff', border: '1px solid #9aa6b8', borderRadius: 8,
              padding: '10px 12px', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, color: '#2d3a52' }}>本趟運費</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#2E7D32' }}>
                NT$ {autoFare.toLocaleString()}
              </span>
            </div>
          )}

          <button type="submit"
                  disabled={stage === 'submitting' || !vendorId || !matchedRule}
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

const checkRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#000',
}

const submitStyle: React.CSSProperties = {
  background: '#2E7D32', color: 'white', border: 'none', borderRadius: 10,
  padding: '14px 16px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
  marginTop: 8,
}
