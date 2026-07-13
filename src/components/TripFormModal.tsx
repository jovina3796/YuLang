'use client'
import { useState, useMemo } from 'react'
import { PencilLine, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createTrip, updateTrip, type TripInput } from '@/app/(dashboard)/trips/actions'

type Vendor = { id: string; name: string; warehouse: string | null }
type RateRule = {
  id: string; vendor_id: string; service_type: string; destination_area: string | null
  base_trips: number | null
  base_fare: number | null; kpi_fare: number | null; base_stops: number | null
  surcharge_per_stop: number | null; pricing_mode: string
  special_rate: number | null; special_rate_note: string | null
  display_order: number | null
}
type Driver  = { id: string; name: string }
type Vehicle = { id: string; plate_number: string }

// 🌟 新增：特殊加成方案型別
export type SurchargeRule = {
  id: string
  vendor_id: string
  name: string
  rate: number
}

export type TripRow = {
  id:               string
  vendor_id:        string
  rate_rule_id:     string
  driver_id:        string | null
  vehicle_id:       string | null
  destination_area: string | null
  departed_at:      string | null
  actual_stops:     number | null
  is_kpi_achieved:  boolean | null
  is_special:       boolean | null
  trip_count:       number
  notes:            string | null
  // 🌟 新增：用於編輯模式帶入的初始值
  surcharge_name?:  string | null
  surcharge_rate?:  number | null
}

interface Props {
  vendors:   Vendor[]
  rateRules: RateRule[]
  drivers:   Driver[]
  vehicles:  Vehicle[]
  surcharges?: SurchargeRule[] // 🌟 接收外層傳入的加成方案 (加上 ? 避免舊程式碼報錯)
  mode:      'create' | 'edit'
  initial?:  TripRow
  trigger?:  React.ReactNode
}

// 🌟 同步更新：使用我們稍早寫好的「精準切帳版」運費計算機
function calcFare(rule: RateRule, tripCount: number, stops: number, isKpi: boolean, isSpecial: boolean, surchargeRate: number = 0) {
  let baseFareTotal = 0
  let extraFareTotal = 0
  const bundle  = Math.max(1, rule.base_trips ?? 1)
  const bundles = Math.ceil(tripCount / bundle)

  switch (rule.pricing_mode) {
    case 'flat':
      baseFareTotal = (rule.base_fare ?? 0) * bundles; break
    case 'base_or_kpi': {
      const base  = isKpi ? (rule.kpi_fare ?? rule.base_fare ?? 0) : (rule.base_fare ?? 0)
      baseFareTotal = base * bundles
      const extraStops = stops > (rule.base_stops ?? 0) ? stops - (rule.base_stops ?? 0) : 0
      extraFareTotal = extraStops * (rule.surcharge_per_stop ?? 0)
      break
    }
    case 'per_stop_count':
      baseFareTotal = stops * (rule.surcharge_per_stop ?? 0); break
    case 'pure_surcharge':
      baseFareTotal = (rule.base_fare ?? 0) * bundles
      extraFareTotal = stops * (rule.surcharge_per_stop ?? 0) * bundles
      break
  }
  
  let fare = baseFareTotal + extraFareTotal
  
  // 舊版的特殊費率打勾
  if (isSpecial && rule.special_rate) fare = fare * (1 + rule.special_rate)
  
  // 🌟 新版的特殊加成 (只針對基本費)
  if (surchargeRate > 0) {
    fare += (baseFareTotal * surchargeRate)
  }
  
  return Math.round(fare)
}

function toLocalDate(s: string): string {
  const d = new Date(s)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function localDateToIso(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()
}

export default function TripFormModal({ vendors, rateRules, drivers, vehicles, surcharges = [], mode, initial, trigger }: Props) {
  const router = useRouter()
  const today  = new Date().toISOString().split('T')[0]

  const initialRule = initial ? rateRules.find(r => r.id === initial.rate_rule_id) : undefined
  const initialDate = initial?.departed_at ? toLocalDate(initial.departed_at) : today

  const [open,          setOpen]         = useState(false)
  const [saving,        setSaving]       = useState(false)
  const [date,          setDate]         = useState(initialDate)
  const [vendorId,      setVendorId]     = useState(initial?.vendor_id ?? '')
  const [area,          setArea]         = useState(initialRule?.destination_area ?? '')
  const [svcType,       setSvcType]      = useState(initialRule?.service_type ?? '')
  const [tripCount,     setTripCount]    = useState(initial?.trip_count ?? 1)
  const [driverId,      setDriverId]     = useState(initial?.driver_id ?? '')
  const [vehicleId,     setVehicleId]    = useState(initial?.vehicle_id ?? '')
  const [deliveryArea, setDeliveryArea] = useState(initial?.destination_area ?? '')
  const [actualStops,  setActualStops]  = useState<number | ''>(initial?.actual_stops ?? '')
  const [isKpi,         setIsKpi]        = useState(initial?.is_kpi_achieved ?? true)
  const [isSpecial,     setIsSpecial]    = useState(initial?.is_special ?? false)
  const [manualOverride, setManualOverride] = useState(false)
  const [manualFare,   setManualFare]   = useState<number | ''>('')
  const [notes,         setNotes]        = useState(initial?.notes ?? '')

  // 🌟 新增：管理特殊加成下拉選單的狀態
  // 如果是編輯模式，嘗試從傳入的 name 找到對應的選項
  const initialSurcharge = initial?.surcharge_name 
    ? surcharges.find(s => s.vendor_id === initial.vendor_id && s.name === initial.surcharge_name)
    : undefined
  const [selectedSurchargeId, setSelectedSurchargeId] = useState<string>(initialSurcharge?.id ?? '')

  const vendorRules = useMemo(
    () => [...rateRules].filter(r => r.vendor_id === vendorId).sort((a, b) =>
      (a.display_order ?? Number.MAX_SAFE_INTEGER) - (b.display_order ?? Number.MAX_SAFE_INTEGER)
    ),
    [rateRules, vendorId],
  )
  
  // 🌟 篩選出該廠商可用的所有特殊加成方案
  const availableSurcharges = useMemo(() => {
    return surcharges.filter(s => s.vendor_id === vendorId)
  }, [surcharges, vendorId])

  const availableAreas = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const r of vendorRules) {
      if (r.destination_area && !seen.has(r.destination_area)) {
        seen.add(r.destination_area); out.push(r.destination_area)
      }
    }
    return out
  }, [vendorRules])

  const availableSvcTypes = useMemo(() => {
    const f = area ? vendorRules.filter(r => r.destination_area === area) : vendorRules
    const seen = new Set<string>()
    const out: string[] = []
    for (const r of f) {
      if (!seen.has(r.service_type)) { seen.add(r.service_type); out.push(r.service_type) }
    }
    return out
  }, [vendorRules, area])

  const matchedRule = useMemo(
    () => vendorRules.find(r => r.service_type === svcType && (area ? r.destination_area === area : true)) ?? null,
    [vendorRules, area, svcType],
  )

  // 🌟 尋找當前選取的加成方案資料
  const currentSurcharge = availableSurcharges.find(s => s.id === selectedSurchargeId)

  const stops      = typeof actualStops === 'number' ? actualStops : 0
  // 🌟 把 currentSurcharge?.rate 傳進去算錢
  const autoFare   = matchedRule ? calcFare(matchedRule, tripCount, stops, isKpi, isSpecial, currentSurcharge?.rate ?? 0) : null
  const isPerStop  = matchedRule?.pricing_mode === 'per_stop_count'
  const isKpiBased = matchedRule?.pricing_mode === 'base_or_kpi'

  const showArea    = availableAreas.length > 0
  const showStops   = !!matchedRule && (matchedRule.base_stops != null || matchedRule.surcharge_per_stop != null)
  const showKpi     = isKpiBased
  const showDeliveryNote = isKpiBased
  const showSpecial = !!matchedRule?.special_rate // 這是舊版的特定節日打勾

  function applyVendor(vid: string) {
    setVendorId(vid)
    const rules = [...rateRules].filter(r => r.vendor_id === vid).sort((a, b) =>
      (a.display_order ?? Number.MAX_SAFE_INTEGER) - (b.display_order ?? Number.MAX_SAFE_INTEGER)
    )
    const areas: string[] = []
    const seenA = new Set<string>()
    for (const r of rules) {
      if (r.destination_area && !seenA.has(r.destination_area)) { seenA.add(r.destination_area); areas.push(r.destination_area) }
    }
    const defaultArea = areas[0] ?? ''
    setArea(defaultArea)
    const types: string[] = []
    const seenT = new Set<string>()
    for (const r of rules) {
      if ((!defaultArea || r.destination_area === defaultArea) && !seenT.has(r.service_type)) {
        seenT.add(r.service_type); types.push(r.service_type)
      }
    }
    setSvcType(types[0] ?? '')
    setTripCount(1); setActualStops(''); setIsKpi(true); setDeliveryArea('')
    setSelectedSurchargeId('') // 🌟 切換廠商時清空加成
  }

  function applyArea(a: string) {
    setArea(a)
    const types: string[] = []
    const seen = new Set<string>()
    for (const r of vendorRules) {
      if (r.destination_area === a && !seen.has(r.service_type)) {
        seen.add(r.service_type); types.push(r.service_type)
      }
    }
    setSvcType(types[0] ?? '')
  }

  function resetForm() {
    if (mode === 'create') {
      setVendorId(''); setArea(''); setSvcType('')
      setTripCount(1); setActualStops(''); setIsKpi(true)
      setIsSpecial(false); setManualOverride(false); setManualFare('')
      setDeliveryArea(''); setNotes('')
      setDriverId(''); setVehicleId(''); setDate(today)
      setSelectedSurchargeId('') // 🌟 記得清空
    }
  }

  async function handleSubmit() {
    if (!vendorId || !matchedRule) return
    const finalFare = manualOverride && manualFare !== '' ? Number(manualFare) : autoFare
    
    // 🌟 將選取的加成資料一併包進 payload 裡
    const payload: TripInput & { surcharge_name?: string | null; surcharge_rate?: number } = {
      vendor_id:        vendorId,
      rate_rule_id:     matchedRule.id,
      driver_id:        driverId  || null,
      vehicle_id:       vehicleId || null,
      destination_area: deliveryArea || null,
      departed_at:      localDateToIso(date),
      actual_stops:     stops || null,
      is_kpi_achieved:  isKpiBased ? isKpi : null,
      is_special:       showSpecial ? isSpecial : false,
      calculated_fare:  autoFare,
      final_fare:       finalFare,
      trip_count:       tripCount,
      notes:            notes || null,
      status:           'completed',
      // 寫入新欄位
      surcharge_name:   currentSurcharge ? currentSurcharge.name : null,
      surcharge_rate:   currentSurcharge ? currentSurcharge.rate : 0,
    }
    
    setSaving(true)
    const { error } = mode === 'create'
      ? await createTrip(payload as TripInput)
      : await updateTrip(initial!.id, payload as TripInput)
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); resetForm(); router.refresh()
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }

  const defaultTrigger = mode === 'create'
    ? <button className="btn btn-primary" onClick={() => setOpen(true)} title="新增車趟" style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px' }}><Plus size={16} /></button>
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
            borderRadius: 14, width: '100%', maxWidth: 560,
            padding: '28px 28px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {mode === 'create' ? '新增車趟紀錄' : '編輯車趟紀錄'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>日期</span>
                <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
              </label>
              <label style={L}>
                <span style={LT}>廠商</span>
                <select className="input" value={vendorId} onChange={e => applyVendor(e.target.value)}>
                  <option value="">— 選擇廠商 —</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.warehouse ? `／${v.warehouse}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {vendorId && (<>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={L}>
                  <span style={LT}>業務類別</span>
                  <select className="input" value={svcType} onChange={e => setSvcType(e.target.value)}>
                    {availableSvcTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label style={L}>
                  <span style={LT}>趟數</span>
                  <input
                    type="number" className="input" min={1} value={tripCount}
                    onChange={e => setTripCount(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={L}>
                  <span style={LT}>司機</span>
                  <select className="input" value={driverId} onChange={e => setDriverId(e.target.value)}>
                    <option value="">— 選擇司機 —</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </label>
                <label style={L}>
                  <span style={LT}>車號</span>
                  <select className="input" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                    <option value="">— 選擇車輛 —</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
                  </select>
                </label>
              </div>

              {(showArea || showStops) && (
                <div style={{ display: 'grid', gridTemplateColumns: showArea && showStops ? '1fr 1fr' : '1fr', gap: 12 }}>
                  {showArea && (
                    <label style={L}>
                      <span style={LT}>地區</span>
                      {availableAreas.length > 1 ? (
                        <select className="input" value={area} onChange={e => applyArea(e.target.value)}>
                          {availableAreas.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      ) : (
                        <input className="input" value={area || ''} disabled />
                      )}
                    </label>
                  )}
                  {showStops && (
                    <label style={L}>
                      <span style={LT}>{isPerStop ? '配送籃件數' : '配送點數'}</span>
                      <input
                        type="number" className="input" min={0}
                        value={actualStops === '' ? '' : actualStops}
                        onChange={e => setActualStops(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder={isPerStop ? '箱籃件數' : '實際配送點數'}
                      />
                    </label>
                  )}
                </div>
              )}

              {(showDeliveryNote || showKpi) && (
                <div style={{ display: 'grid', gridTemplateColumns: showDeliveryNote && showKpi ? '1fr auto' : '1fr', gap: 12, alignItems: 'end' }}>
                  {showDeliveryNote && (
                    <label style={L}>
                      <span style={LT}>配送區域備註</span>
                      <input
                        type="text" className="input" value={deliveryArea}
                        onChange={e => setDeliveryArea(e.target.value)}
                        placeholder="例：汐止、基隆…"
                      />
                    </label>
                  )}
                  {showKpi && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10 }}>
                      <input type="checkbox" checked={isKpi} onChange={e => setIsKpi(e.target.checked)} />
                      <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>KPI 達標</span>
                    </label>
                  )}
                </div>
              )}

              {/* 🌟 拔除舊版 isSpecial checkbox，換成新版動態下拉選單 */}
              {availableSurcharges.length > 0 && (
                <label style={L}>
                  <span style={LT}>特殊加成方案</span>
                  <select 
                    className="input" 
                    value={selectedSurchargeId} 
                    onChange={e => setSelectedSurchargeId(e.target.value)}
                  >
                    <option value="">— 無特殊加成 —</option>
                    {availableSurcharges.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} (加成 {(s.rate * 100).toFixed(0)}%)
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* 如果廠商剛好沒有設定任何新版加成，但這條費率規則有舊版打勾，做個兼容保留 */}
              {showSpecial && availableSurcharges.length === 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={isSpecial} onChange={e => setIsSpecial(e.target.checked)} />
                  <span style={{ fontSize: 13 }}>
                    加成費（特定節日／特殊情形，基本運費加成 {(matchedRule?.special_rate ?? 0) * 100}%）
                  </span>
                </label>
              )}

              {autoFare !== null && (
                <div style={{
                  background: 'rgba(46,160,67,0.07)', border: '1px solid rgba(46,160,67,0.22)',
                  borderRadius: 8, padding: '12px 18px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>預估運費</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                      {matchedRule?.pricing_mode === 'flat' && (() => {
                        const b = Math.max(1, matchedRule.base_trips ?? 1)
                        const n = Math.ceil(tripCount / b)
                        return b > 1
                          ? `NT$${matchedRule.base_fare?.toLocaleString()} / ${b} 趟 × ${n} 組（共 ${tripCount} 趟）`
                          : `NT$${matchedRule.base_fare?.toLocaleString()} × ${tripCount} 趟`
                      })()}
                      {matchedRule?.pricing_mode === 'base_or_kpi' && (() => {
                        const b = Math.max(1, matchedRule.base_trips ?? 1)
                        const n = Math.ceil(tripCount / b)
                        const unit = isKpi ? matchedRule.kpi_fare : matchedRule.base_fare
                        const head = b > 1
                          ? `${isKpi ? 'KPI' : '基本'} NT$${unit?.toLocaleString()} / ${b} 趟 × ${n} 組`
                          : `${isKpi ? 'KPI' : '基本'} NT$${unit?.toLocaleString()} × ${tripCount} 趟`
                        return `${head}${stops > (matchedRule.base_stops ?? 0) ? ` ＋ 超點費` : ''}`
                      })()}
                      {matchedRule?.pricing_mode === 'per_stop_count' &&
                        `${stops} 件 × NT$${matchedRule.surcharge_per_stop}`}
                      
                      {/* 如果有套用加成，在小字提醒 */}
                      {currentSurcharge && ` ＋ 加成 ${(currentSurcharge.rate * 100).toFixed(0)}%`}
                    </div>
                  </div>
                  <span style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent2)' }}>
                    NT$ {autoFare.toLocaleString()}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={manualOverride}
                    onChange={e => {
                      setManualOverride(e.target.checked)
                      if (e.target.checked && manualFare === '' && autoFare !== null) setManualFare(autoFare)
                    }}
                  />
                  <span style={{ fontSize: 13 }}>手動更改運費為</span>
                </label>
                <input
                  type="number" className="input" min={0}
                  style={{ flex: 1 }}
                  disabled={!manualOverride}
                  value={manualFare === '' ? '' : manualFare}
                  onChange={e => setManualFare(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="$"
                />
              </div>

              <label style={L}>
                <span style={LT}>備註</span>
                <input
                  type="text" className="input" value={notes}
                  onChange={e => setNotes(e.target.value)} placeholder="選填"
                />
              </label>
            </>)}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={() => { setOpen(false); resetForm() }}>取消</button>
              <button
                className="btn btn-primary"
                disabled={!vendorId || !svcType || saving}
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
