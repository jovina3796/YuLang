import { createServiceClient } from '@/lib/supabase/service'
import DriverVendorRateModal from '@/components/DriverVendorRateModal'
import DriverVendorRateRowActions from '@/components/DriverVendorRateRowActions'

export default async function DriverRatesTabPage() {
  const supabase = createServiceClient()

  // 同時抓取例外清單、啟用中的司機、以及所有廠商清單
  const [{ data: rates }, { data: drivers }, { data: vendors }] = await Promise.all([
    supabase
      .from('driver_vendor_rates')
      .select('id, driver_id, vendor_id, commission_rate, updated_at, drivers(name), vendors(name, warehouse)')
      .order('updated_at', { ascending: false }),
    supabase.from('drivers').select('id, name').eq('status', 'active').order('name'),
    supabase.from('vendors').select('id, name, warehouse').order('name'),
  ])

  const driverOptions = drivers ?? []
  const vendorOptions = vendors ?? []

  return (
    <div style={{ maxWidth: 840 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <DriverVendorRateModal mode="create" drivers={driverOptions} vendors={vendorOptions} />
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">司機例外抽成設定</div>
            <div className="card-sub">針對個別司機與專屬廠商設定獨立比率，共 {rates?.length ?? 0} 筆</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>司機名稱</th>
              <th style={{ textAlign: 'left' }}>指定廠商 / 倉庫</th>
              <th style={{ textAlign: 'right' }}>例外抽成比例 (%)</th>
              <th style={{ textAlign: 'right', width: 140 }}>最後修改</th>
              <th style={{ width: 80, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!rates?.length ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: 36 }}>尚無例外規則設定</td></tr>
            ) : rates.map((r: any) => {
              const vName = r.vendors?.name ?? '未知廠商'
              const vWh   = r.vendors?.warehouse ? `／${r.vendors?.warehouse}` : ''
              const dateStr = r.updated_at ? new Date(r.updated_at).toLocaleDateString('zh-TW') : ''
              return (
                <tr key={r.id}>
                  <td className="name" style={{ fontWeight: 600 }}>{r.drivers?.name ?? '未知司機'}</td>
                  <td><span className="badge badge-blue">{vName}{vWh}</span></td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--accent2)', fontWeight: 700, fontSize: 14 }}>
                    {Number(r.commission_rate)}%
                  </td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 12, color: 'var(--text3)' }}>{dateStr}</td>
                  <td>
                    <DriverVendorRateRowActions
                      row={{ id: r.id, driver_id: r.driver_id, vendor_id: r.vendor_id, commission_rate: r.commission_rate }}
                      drivers={driverOptions}
                      vendors={vendorOptions}
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
