import { createServiceClient } from '@/lib/supabase/service'
import VendorSurchargeModal from '@/components/VendorSurchargeModal'
import VendorSurchargeRowActions from '@/components/VendorSurchargeRowActions'

export default async function VendorSurchargesTabPage() {
  const supabase = createServiceClient()

  // 同時抓取所有加成設定方案與有效廠商清單
  const [{ data: surcharges }, { data: vendors }] = await Promise.all([
    supabase
      .from('vendor_surcharges')
      .select('id, vendor_id, name, keyword, rate, is_active, display_order, vendors(name, warehouse)')
      .order('display_order', { ascending: true }),
    supabase.from('vendors').select('id, name, warehouse').order('name'),
  ])

  const vendorOptions = vendors ?? []

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <VendorSurchargeModal mode="create" vendors={vendorOptions} />
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">廠商特殊加成方案設定</div>
            <div className="card-sub">用於颱風天、特定節日等比例加成規則，共 {surcharges?.length ?? 0} 筆</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>廠商 / 倉庫</th>
              <th style={{ textAlign: 'left' }}>加成方案名稱</th>
              <th style={{ textAlign: 'left' }}>LINE 回報關鍵字</th>
              <th style={{ textAlign: 'right' }}>加成比例 (%)</th>
              <th style={{ width: 180, textAlign: 'right' }}>狀態與操作</th>
            </tr>
          </thead>
          <tbody>
            {!surcharges?.length ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: 36 }}>目前尚無任何加成方案規則</td></tr>
            ) : surcharges.map((s: any) => {
              const vName = s.vendors?.name ?? '未知廠商'
              const vWh   = s.vendors?.warehouse ? `／${s.vendors?.warehouse}` : ''
              const ratePct = (Number(s.rate) * 100).toFixed(0)

              return (
                <tr key={s.id} style={{ opacity: s.is_active ? 1 : 0.55 }}>
                  <td className="name" style={{ fontWeight: 600 }}>{vName}{vWh}</td>
                  <td><span className="badge badge-blue">{s.name}</span></td>
                  <td><code className="mono" style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>{s.keyword}</code></td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--amber2)', fontWeight: 700, fontSize: 14 }}>
                    +{ratePct}%
                  </td>
                  <td>
                    <VendorSurchargeRowActions
                      row={{ id: s.id, vendor_id: s.vendor_id, name: s.name, keyword: s.keyword, rate: Number(s.rate), display_order: s.display_order ?? 10 }}
                      vendors={vendorOptions}
                      isActive={s.is_active}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
