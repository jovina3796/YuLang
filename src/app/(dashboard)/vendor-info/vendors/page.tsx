import { createServiceClient } from '@/lib/supabase/service'
import VendorFormModal from '@/components/VendorFormModal'
import VendorRowActions from '@/components/VendorRowActions'
import VendorImportExport from '@/components/VendorImportExport'
import SortableTh from '@/components/SortableTh'
import { PRICING_MODE, pricingLabel, billingPeriodLabel } from '../_helpers'

export default async function VendorsTabPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>
}) {
  const sp = await searchParams
  const sortField = sp.sort ?? 'name'
  const ascending = (sp.dir ?? 'asc') === 'asc'

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
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        <VendorImportExport />
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
