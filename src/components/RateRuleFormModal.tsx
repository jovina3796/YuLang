'use client'
import { useState } from 'react'
import { PencilLine, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createRateRule, updateRateRule, type RateRuleInput } from '@/app/(dashboard)/rates/actions'

type Vendor = { id: string; name: string; warehouse: string | null }

export type RateRuleRow = {
  id:                    string
  vendor_id:             string
  service_type:          string
  destination_area:      string | null
  pricing_mode:          string
  base_trips:            number
  base_fare:             number | null
  kpi_fare:              number | null
  base_stops:            number | null
  surcharge_per_stop:    number | null
  special_rate:          number | null
  special_rate_note:     string | null
  upstream_commission:   number | null
  upstream_commission_2: number | null
  commission_mode:       string
  seasonal_note:         string | null
  is_active:             boolean
  display_order:         number | null
}

interface Props {
  vendors:  Vendor[]
  mode:     'create' | 'edit'
  initial?: RateRuleRow
  trigger?: React.ReactNode
}

const PRICING_OPTIONS = [
  { value: 'flat',           label: '固定運費' },
  { value: 'per_stop_count', label: '趟次計費' },
  { value: 'pure_surcharge', label: '加成計費' },
]

const numOrNull = (v: number | ''): number | null => v === '' ? null : Number(v)

export default function RateRuleFormModal({ vendors, mode, initial, trigger }: Props) {
  const router = useRouter()

  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)

  const [vendorId,            setVendorId]            = useState(initial?.vendor_id ?? '')
  const [serviceType,         setServiceType]         = useState(initial?.service_type ?? '')
  const [destinationArea,     setDestinationArea]     = useState(initial?.destination_area ?? '')
  const [pricingMode,         setPricingMode]         = useState(
    initial?.pricing_mode && initial.pricing_mode !== 'base_or_kpi' ? initial.pricing_mode : 'flat'
  )
  const [hasKpi,              setHasKpi]              = useState(initial?.pricing_mode === 'base_or_kpi')
  const [baseTrips,           setBaseTrips]           = useState<number | ''>(initial?.base_trips ?? 1)
  const [baseFare,            setBaseFare]            = useState<number | ''>(initial?.base_fare ?? '')
  const [kpiFare,             setKpiFare]             = useState<number | ''>(initial?.kpi_fare ?? '')
  const [baseStops,           setBaseStops]           = useState<number | ''>(initial?.base_stops ?? '')
  const [surchargePerStop,    setSurchargePerStop]    = useState<number | ''>(initial?.surcharge_per_stop ?? '')
  const [specialRate,         setSpecialRate]         = useState<number | ''>(initial?.special_rate ?? '')
  const [specialRateNote,     setSpecialRateNote]     = useState(initial?.special_rate_note ?? '')
  const [upstreamCommission,  setUpstreamCommission]  = useState<number | ''>(initial?.upstream_commission ?? '')
  const [upstreamCommission2, setUpstreamCommission2] = useState<number | ''>(initial?.upstream_commission_2 ?? '')
  const [commissionMode,      setCommissionMode]      = useState(initial?.commission_mode ?? 'single')
  const [seasonalNote,        setSeasonalNote]        = useState(initial?.seasonal_note ?? '')
  const [isActive,            setIsActive]            = useState(initial?.is_active ?? true)
  const [displayOrder,        setDisplayOrder]        = useState<number | ''>(initial?.display_order ?? '')

  function resetForm() {
    if (mode === 'create') {
      setVendorId(''); setServiceType(''); setDestinationArea('')
      setPricingMode('flat'); setHasKpi(false); setBaseTrips(1); setBaseFare(''); setKpiFare('')
      setBaseStops(''); setSurchargePerStop(''); setSpecialRate(''); setSpecialRateNote('')
      setUpstreamCommission(''); setUpstreamCommission2('')
      setCommissionMode('single'); setSeasonalNote(''); setIsActive(true); setDisplayOrder('')
    }
  }

  async function handleSubmit() {
    if (!vendorId || !serviceType.trim()) return
    const finalPricingMode = hasKpi ? 'base_or_kpi' : pricingMode
    const payload: RateRuleInput = {
      vendor_id:             vendorId,
      service_type:          serviceType.trim(),
      destination_area:      destinationArea.trim() || null,
      pricing_mode:          finalPricingMode,
      base_trips:            baseTrips === '' ? 1 : Number(baseTrips),
      base_fare:             numOrNull(baseFare),
      kpi_fare:              hasKpi ? numOrNull(kpiFare) : null,
      base_stops:            numOrNull(baseStops),
      surcharge_per_stop:    numOrNull(surchargePerStop),
      special_rate:          numOrNull(specialRate),
      special_rate_note:     specialRateNote.trim() || null,
      upstream_commission:   numOrNull(upstreamCommission),
      upstream_commission_2: numOrNull(upstreamCommission2),
      commission_mode:       commissionMode,
      seasonal_note:         seasonalNote.trim() || null,
      is_active:             isActive,
      display_order:         numOrNull(displayOrder),
    }
    setSaving(true)
    const { error } = mode === 'create'
      ? await createRateRule(payload)
      : await updateRateRule(initial!.id, payload)
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); resetForm(); router.refresh()
  }

  const needs = {
    baseFare:         ['flat', 'pure_surcharge'].includes(pricingMode) || hasKpi,
    kpiFare:          hasKpi,
    baseStops:        ['per_stop_count'].includes(pricingMode) || hasKpi,
    surchargePerStop: ['per_stop_count', 'pure_surcharge'].includes(pricingMode) || hasKpi,
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }

  const defaultTrigger = mode === 'create'
    ? <button className="btn btn-primary" onClick={() => setOpen(true)} title="新增規則" style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px' }}><Plus size={16} /></button>
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
            borderRadius: 14, width: '100%', maxWidth: 760,
            padding: '28px 28px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {mode === 'create' ? '新增運費規則' : '編輯運費規則'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>廠商</span>
                <select className="input" value={vendorId} onChange={e => setVendorId(e.target.value)} disabled={mode === 'edit'}>
                  <option value="">— 選擇廠商 —</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.warehouse ? `／${v.warehouse}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label style={L}>
                <span style={LT}>計費方式</span>
                <select className="input" value={pricingMode} onChange={e => setPricingMode(e.target.value)}>
                  {PRICING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>業務類別</span>
                <input
                  type="text" className="input" value={serviceType}
                  onChange={e => setServiceType(e.target.value)} placeholder="例：常溫配送"
                />
              </label>
              <label style={L}>
                <span style={LT}>地區（可空）</span>
                <input
                  type="text" className="input" value={destinationArea}
                  onChange={e => setDestinationArea(e.target.value)} placeholder="例：北北基"
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>基本趟數</span>
                <input
                  type="number" className="input" min={1} value={baseTrips}
                  onChange={e => setBaseTrips(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              {needs.baseFare && (
                <label style={L}>
                  <span style={LT}>基本運費 (NT$)</span>
                  <input
                    type="number" className="input" min={0} value={baseFare}
                    onChange={e => setBaseFare(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </label>
              )}
            </div>

            {(needs.baseStops || needs.surchargePerStop) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {needs.baseStops && (
                  <label style={L}>
                    <span style={LT}>基本點數</span>
                    <input
                      type="number" className="input" min={0} value={baseStops}
                      onChange={e => setBaseStops(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </label>
                )}
                {needs.surchargePerStop && (
                  <label style={L}>
                    <span style={LT}>超點費／件 (NT$)</span>
                    <input
                      type="number" className="input" min={0} step="0.1" value={surchargePerStop}
                      onChange={e => setSurchargePerStop(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </label>
                )}
              </div>
            )}

            <div style={{
              border: '1px solid var(--border)', borderRadius: 10,
              padding: hasKpi ? '14px 16px 16px' : '10px 16px',
              background: hasKpi ? 'rgba(46,160,67,0.05)' : 'transparent',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={hasKpi} onChange={e => setHasKpi(e.target.checked)} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>套用 KPI 規則</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>達到 KPI 時改以 KPI 運費取代基本運費</span>
              </label>

              {hasKpi && (
                <label style={{ ...L, maxWidth: 240 }}>
                  <span style={LT}>KPI 運費 (NT$)</span>
                  <input
                    type="number" className="input" min={0} value={kpiFare}
                    onChange={e => setKpiFare(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </label>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>特殊加成 (0~1)</span>
                <input
                  type="number" className="input" min={0} max={1} step="0.01" value={specialRate}
                  onChange={e => setSpecialRate(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="例：0.3"
                />
              </label>
              <label style={L}>
                <span style={LT}>特殊加成說明</span>
                <input
                  type="text" className="input" value={specialRateNote}
                  onChange={e => setSpecialRateNote(e.target.value)} placeholder="例：春節加成 30%"
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>上游抽成</span>
                <input
                  type="number" className="input" min={0} step="0.01" value={upstreamCommission}
                  onChange={e => setUpstreamCommission(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label style={L}>
                <span style={LT}>上游抽成 2</span>
                <input
                  type="number" className="input" min={0} step="0.01" value={upstreamCommission2}
                  onChange={e => setUpstreamCommission2(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label style={L}>
                <span style={LT}>抽成模式</span>
                <select className="input" value={commissionMode} onChange={e => setCommissionMode(e.target.value)}>
                  <option value="single">single</option>
                  <option value="tiered">tiered</option>
                </select>
              </label>
            </div>

            <label style={L}>
              <span style={LT}>季節備註</span>
              <input
                type="text" className="input" value={seasonalNote}
                onChange={e => setSeasonalNote(e.target.value)} placeholder="選填"
              />
            </label>

            <label style={L}>
              <span style={LT}>顯示順序（數字越小越前面，留空則排最後）</span>
              <input
                type="number" className="input" value={displayOrder}
                onChange={e => setDisplayOrder(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="例：10"
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              <span style={{ fontSize: 13 }}>啟用此規則</span>
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={() => { setOpen(false); resetForm() }}>取消</button>
              <button
                className="btn btn-primary"
                disabled={!vendorId || !serviceType.trim() || saving}
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
