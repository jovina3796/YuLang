import { Building2, Tags } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/service'
import SubNavTabs from '@/components/SubNavTabs'
import VendorFormModal from '@/components/VendorFormModal'
import VendorRowActions from '@/components/VendorRowActions'
import RateRuleFormModal from '@/components/RateRuleFormModal'
import RateRuleRowActions from '@/components/RateRuleRowActions'
import SortableTh from '@/components/SortableTh'

type TabKey = 'vendors' | 'rates'

const TABS = [
  { key: 'vendors' as const, label: '廠商設定', Icon: Building2 },
  { key: 'rates'   as const, label: '運費設定', Icon: Tags      },
]

const PRICING_LABEL: Record<string, string> = {
  flat:           '固定運費',
  base_or_kpi:    '固定運費',
  per_stop_count: '趟次計費',
  pure_surcharge: '加成計費',
}
const PRICING_MODE: Record<string, string> = {
  flat:            '固定運費',
  base_or_kpi:     '基本/KPI',
  per_stop_count:  '趟次計費',
  pure_surcharge:  '加成計費',
}

function pricingLabel(name: string | null, warehouse: string | null, mode: string, fallback: Record<string,string> = PRICING_LABEL): string {
  const key = `${name ?? ''}${warehouse ? `-${warehouse}` : ''}`
  if (key === '全聯-桃園') return '籃件數計費'
  if (key === '全聯-瑞芳' || name === '鮮湧' || name === '弘舜') return '店點數計費'
  return fallback[mode] ?? mode
}

function billingPeriodLabel(startDay: number, delay: number): string {
  const range = startDay === 26 ? '上月26日 ~ 當月25日' : '1日 ~ 月底'
  return `${range}（延後 ${delay} 個月支付）`
}

export default async function VendorInfoPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sort?: string; dir?: string }>
}) {
  const sp = await searchParams
  const tab: TabKey = sp.tab === 'rates' ? 'rates' : 'vendors'
  const sortField = sp.sort ?? (tab === 'vendors' ? 'name' : 'display_order')
  const ascending = (sp.dir ?? 'asc') === 'asc'

  return (
    <div>
      <SubNavTabs<TabKey> basePath="/vendor-info" tabs={TABS} activeTab={tab} />
      {tab === 'vendors'
        ? <VendorsTab sortField={sortField} ascending={ascending} />
        : <RatesTab sortField={sortField} ascending={ascending} />}
    </div>
  )
}

async function VendorsTab({ sortField, ascending }: { sortField: string; ascending: boolean }) {
  const supabase = createServiceClient()

  const { data: vendors } = await supabase
    .from('vendors')
    .select('*')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('name')

  const { data: rules } = await supabase
    .from('vendor_rate_rules')
    .select('vendor_id, pricing_mode, upstream_commission, commission_mode')

  const rulesByVendor: Record<string, typeof rules> = {}
  rules?.forEach(r => {
    if (!rulesByVendor[r.vendor_id]) rulesByVendor[r.vendor_id] = []
    rulesByVendor[r.vendor_id]!.push(r)
  })

  const getKey = (v: any): string | number => {
    switch (sortField) {
      case 'name':         return v.name ?? ''
      case 'warehouse':    return v.warehouse ?? ''
      case 'pricing_mode': return rulesByVendor[v.id]?.[0]?.pricing_mode ?? ''
      case 'billing':      return v.billing_cycle_start_day ?? 1
      case 'contact':      return v.contact_name ?? ''
      default:             return ''
    }
  }
  const sortedVendors = [...(vendors ?? [])].sort((a, b) => {
    const av = getKey(a), bv = getKey(b)
    if (av === bv) return 0
    if (typeof av === 'number' && typeof bv === 'number') return ascending ? av - bv : bv - av
    const cmp = String(av).localeCompare(String(bv), 'zh-Hant')
    return ascending ? cmp : -cmp
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <VendorFormModal mode="create" />
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">廠商管理</div>
            <div className="card-sub">共 {vendors?.length ?? 0} 家廠商</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <SortableTh field="name" defaultField="name" defaultDir="asc">廠商名稱</SortableTh>
              <SortableTh field="warehouse" defaultField="name" defaultDir="asc">倉庫</SortableTh>
              <SortableTh field="pricing_mode" defaultField="name" defaultDir="asc">計費方式</SortableTh>
              <SortableTh field="billing" defaultField="name" defaultDir="asc">計費區間</SortableTh>
              <SortableTh field="contact" defaultField="name" defaultDir="asc">聯絡人</SortableTh>
              <th style={{ width: 80 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!sortedVendors.length ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>尚無資料</td></tr>
            ) : sortedVendors.map((v: any) => {
              const vRules = rulesByVendor[v.id] ?? []
              const firstRule = vRules[0]
              const pMode = firstRule ? pricingLabel(v.name, v.warehouse, firstRule.pricing_mode, PRICING_MODE) : ''
              const startDay = v.billing_cycle_start_day ?? 1
              const delay = v.payment_delay_months ?? 2
              return (
                <tr key={v.id}>
                  <td className="name">{v.name}</td>
                  <td>{v.warehouse ?? ''}</td>
                  <td>
                    <span className="badge badge-blue">{pMode}</span>
                    {vRules.length > 1 && (
                      <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>+{vRules.length - 1}</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{billingPeriodLabel(startDay, delay)}</td>
                  <td>{v.contact_name ?? ''}{v.phone ? ` ${v.phone}` : ''}</td>
                  <td>
                    <VendorRowActions vendor={{
                      id: v.id,
                      name: v.name,
                      warehouse: v.warehouse,
                      contact_name: v.contact_name ?? null,
                      phone: v.phone ?? null,
                      payment_terms: v.payment_terms ?? null,
                      display_order: v.display_order ?? null,
                      billing_cycle_start_day: v.billing_cycle_start_day ?? 1,
                      payment_delay_months:    v.payment_delay_months    ?? 2,
                    }} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

async function RatesTab({ sortField, ascending }: { sortField: string; ascending: boolean }) {
  const supabase = createServiceClient()

  const [{ data: vendors }, { data: rules }] = await Promise.all([
    supabase.from('vendors').select('id, name, warehouse').order('display_order', { ascending: true, nullsFirst: false }).order('name'),
    supabase
      .from('vendor_rate_rules')
      .select('*, vendors(name, warehouse)')
      .order('vendor_id')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('service_type')
      .order('destination_area'),
  ])

  const grouped: Record<string, typeof rules> = {}
  rules?.forEach(r => {
    const key = r.vendor_id
    if (!grouped[key]) grouped[key] = []
    grouped[key]!.push(r)
  })

  const vendorMap: Record<string, { name: string; warehouse: string | null }> = {}
  vendors?.forEach(v => { vendorMap[v.id] = { name: v.name, warehouse: v.warehouse } })

  const getKey = (r: any): string | number => {
    switch (sortField) {
      case 'display_order':      return r.display_order ?? Number.MAX_SAFE_INTEGER
      case 'service_type':       return r.service_type ?? ''
      case 'destination_area':   return r.destination_area ?? ''
      case 'pricing_mode':       return PRICING_LABEL[r.pricing_mode] ?? r.pricing_mode ?? ''
      case 'base_trips':         return r.base_trips ?? -1
      case 'base_fare':          return r.base_fare ?? -1
      case 'kpi_fare':           return r.kpi_fare ?? -1
      case 'base_stops':         return r.base_stops ?? -1
      case 'surcharge_per_stop': return r.surcharge_per_stop ?? -1
      case 'special_rate':       return r.special_rate ?? -1
      case 'is_active':          return r.is_active ? 1 : 0
      default:                   return ''
    }
  }
  const sortRules = (arr: any[]) => [...arr].sort((a, b) => {
    const av = getKey(a), bv = getKey(b)
    if (av === bv) return 0
    if (typeof av === 'number' && typeof bv === 'number') return ascending ? av - bv : bv - av
    const cmp = String(av).localeCompare(String(bv), 'zh-Hant')
    return ascending ? cmp : -cmp
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <RateRuleFormModal vendors={vendors ?? []} mode="create" />
      </div>

      {Object.entries(grouped).map(([vendorId, vendorRules]) => {
        const v = vendorMap[vendorId] ?? (vendorRules![0] as any).vendors
        const vendorName = v ? `${v.name}${v.warehouse ? `／${v.warehouse}` : ''}` : vendorId
        return (
          <div key={vendorId} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text2)',
              marginBottom: 8, paddingLeft: 2,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>{vendorName}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>
                {vendorRules!.length} 筆規則
              </span>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <table style={{ tableLayout: 'fixed', width: '100%' }}>
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '6%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <SortableTh field="service_type" defaultField="display_order" defaultDir="asc" align="center">業務類別</SortableTh>
                    <SortableTh field="destination_area" defaultField="display_order" defaultDir="asc" align="center">地區</SortableTh>
                    <SortableTh field="pricing_mode" defaultField="display_order" defaultDir="asc" align="center">計費方式</SortableTh>
                    <SortableTh field="base_trips" defaultField="display_order" defaultDir="asc" align="center">基本趟數</SortableTh>
                    <SortableTh field="base_fare" defaultField="display_order" defaultDir="asc" align="right">基本運費</SortableTh>
                    <SortableTh field="kpi_fare" defaultField="display_order" defaultDir="asc" align="right">KPI 運費</SortableTh>
                    <SortableTh field="base_stops" defaultField="display_order" defaultDir="asc" align="center">基本點數</SortableTh>
                    <SortableTh field="surcharge_per_stop" defaultField="display_order" defaultDir="asc" align="right">超點費／件</SortableTh>
                    <SortableTh field="special_rate" defaultField="display_order" defaultDir="asc" align="center">特殊加成</SortableTh>
                    <SortableTh field="is_active" defaultField="display_order" defaultDir="asc" align="center">狀態</SortableTh>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortRules(vendorRules!).map((r: any) => (
                    <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.45 }}>
                      <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{r.service_type}</td>
                      <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{r.destination_area ?? ''}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-blue">
                          {pricingLabel(v?.name ?? '', v?.warehouse ?? null, r.pricing_mode)}
                        </span>
                      </td>
                      <td className="mono" style={{ textAlign: 'center' }}>{r.base_trips}</td>
                      <td className="mono" style={{ color: 'var(--accent2)', textAlign: 'right' }}>
                        {r.base_fare != null ? `NT$${r.base_fare.toLocaleString()}` : ''}
                      </td>
                      <td className="mono" style={{ color: 'var(--blue)', textAlign: 'right' }}>
                        {r.kpi_fare != null ? `NT$${r.kpi_fare.toLocaleString()}` : ''}
                      </td>
                      <td className="mono" style={{ textAlign: 'center' }}>{r.base_stops ?? ''}</td>
                      <td className="mono" style={{ color: 'var(--amber2)', textAlign: 'right' }}>
                        {r.surcharge_per_stop != null ? `NT$${r.surcharge_per_stop}` : ''}
                      </td>
                      <td style={{ fontSize: 12, textAlign: 'center' }}>
                        {r.special_rate != null
                          ? <span className="badge badge-amber">+{(r.special_rate * 100).toFixed(0)}%</span>
                          : <span style={{ color: 'var(--text3)' }}>無</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {r.is_active
                          ? <span className="badge badge-green">啟用</span>
                          : <span className="badge badge-red">停用</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <RateRuleRowActions rule={r} vendors={vendors ?? []} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {Object.keys(grouped).length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          尚無運費規則資料
        </div>
      )}
    </>
  )
}
