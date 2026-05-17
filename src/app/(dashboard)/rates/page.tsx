import { createServiceClient } from '@/lib/supabase/service'
import RateRuleFormModal from '@/components/RateRuleFormModal'
import RateRuleRowActions from '@/components/RateRuleRowActions'
import SortableTh from '@/components/SortableTh'

const PRICING_LABEL: Record<string, string> = {
  flat:           '固定運費',
  base_or_kpi:    '固定運費',
  per_stop_count: '趟次計費',
  pure_surcharge: '加成計費',
}

function pricingLabel(name: string | null, warehouse: string | null, mode: string): string {
  const key = `${name ?? ''}${warehouse ? `-${warehouse}` : ''}`
  if (key === '全聯-桃園') return '籃件數計費'
  if (key === '全聯-瑞芳' || name === '鮮湧' || name === '弘舜') return '店點數計費'
  return PRICING_LABEL[mode] ?? mode
}

export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>
}) {
  const supabase = createServiceClient()
  const { sort, dir } = await searchParams
  const sortField = sort ?? 'display_order'
  const ascending = (dir ?? 'asc') === 'asc'

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

  // Group rules by vendor
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
    <div>
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
    </div>
  )
}
