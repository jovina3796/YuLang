import { createServiceClient } from '@/lib/supabase/service'
import { Paperclip } from 'lucide-react'
import InspectionFormModal from '@/components/InspectionFormModal'
import InspectionRowActions from '@/components/InspectionRowActions'

export default async function InspectionPage() {
  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  const [{ data: vehicles }, { data: logs }] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, plate_number, category, manufacture_date, last_inspection_date, next_inspection_date, status')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('plate_number'),
    supabase
      .from('inspection_logs')
      .select('*')
      .order('inspected_at', { ascending: false })
      .limit(200),
  ])

  const list = vehicles ?? []
  const upcoming = list.filter(v => v.next_inspection_date && v.next_inspection_date >= today && v.next_inspection_date <= in30)
  const overdue  = list.filter(v => v.next_inspection_date && v.next_inspection_date < today)

  const vehicleMap: Record<string, { plate_number: string }> = {}
  list.forEach(v => { vehicleMap[v.id] = { plate_number: v.plate_number } })

  const modalVehicles = list.map(v => ({
    id: v.id, plate_number: v.plate_number, manufacture_date: v.manufacture_date,
  }))

  return (
    <div>
      {(overdue.length > 0 || upcoming.length > 0) && (
        <div className="alert-row" style={{ marginBottom: 20 }}>
          ⚠ {overdue.length > 0 && `${overdue.length} 輛已過期、`}{upcoming.length} 輛 30 天內到期
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <InspectionFormModal vehicles={modalVehicles} mode="create" />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><div className="card-title">車輛驗車狀態</div></div>
        <table>
          <thead>
            <tr>
              <th>車牌</th>
              <th>類別</th>
              <th>出廠年月</th>
              <th>上次驗車</th>
              <th>下次驗車</th>
              <th>狀態</th>
            </tr>
          </thead>
          <tbody>
            {!list.length ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>尚無資料</td></tr>
            ) : list.map((v: any) => {
              const overdueFlag  = v.next_inspection_date && v.next_inspection_date < today
              const upcomingFlag = v.next_inspection_date && v.next_inspection_date >= today && v.next_inspection_date <= in30
              return (
                <tr key={v.id}>
                  <td className="mono" style={{ textAlign: 'center' }}>{v.plate_number}</td>
                  <td style={{ textAlign: 'center' }}>{v.category ?? ''}</td>
                  <td className="mono" style={{ textAlign: 'center' }}>{v.manufacture_date ?? ''}</td>
                  <td className="mono" style={{ textAlign: 'center' }}>{v.last_inspection_date ?? ''}</td>
                  <td className="mono" style={{
                    textAlign: 'center',
                    color: overdueFlag ? 'var(--red)' : upcomingFlag ? 'var(--amber2)' : undefined,
                    fontWeight: overdueFlag || upcomingFlag ? 600 : undefined,
                  }}>
                    {v.next_inspection_date ?? ''}
                    {overdueFlag  && ' ⚠ 已過期'}
                    {upcomingFlag && ' ⚠ 即將到期'}
                  </td>
                  <td style={{ textAlign: 'center' }}>{v.status === 'active' ? '正常' : v.status === 'maintenance' ? '維修' : '退役'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">驗車紀錄</div>
            <div className="card-sub">共 {logs?.length ?? 0} 筆</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>車牌號碼</th>
              <th style={{ textAlign: 'center' }}>驗車日期</th>
              <th style={{ textAlign: 'center' }}>結果</th>
              <th style={{ textAlign: 'left' }}>檢驗廠商</th>
              <th style={{ textAlign: 'right' }}>費用</th>
              <th style={{ textAlign: 'center' }}>下次檢驗日期</th>
              <th style={{ textAlign: 'center' }}>扣帳年月</th>
              <th style={{ textAlign: 'left' }}>備註</th>
              <th style={{ textAlign: 'center' }}>單據</th>
              <th style={{ width: 80, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!logs?.length ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>尚無驗車紀錄</td></tr>
            ) : logs.map((l: any) => (
              <tr key={l.id}>
                <td className="mono" style={{ textAlign: 'center' }}>{vehicleMap[l.vehicle_id]?.plate_number ?? ''}</td>
                <td className="mono" style={{ textAlign: 'center' }}>{l.inspected_at}</td>
                <td style={{ textAlign: 'center' }}>
                  {l.result === '通過'   ? <span className="badge badge-green">通過</span> :
                   l.result === '複驗'   ? <span className="badge badge-amber">複驗</span> :
                   l.result === '不合格' ? <span className="badge badge-red">不合格</span> :
                   l.result ?? ''}
                </td>
                <td style={{ textAlign: 'left' }}>{l.vendor_name ?? ''}</td>
                <td className="mono" style={{ textAlign: 'right' }}>{l.fee != null ? l.fee.toLocaleString() : ''}</td>
                <td className="mono" style={{ textAlign: 'center' }}>{l.next_due_date ?? ''}</td>
                <td className="mono" style={{ textAlign: 'center', color: l.deduct_month ? undefined : 'var(--text3)' }}>
                  {l.deduct_month
                    ? String(l.deduct_month).slice(0, 7)
                    : `${String(l.inspected_at).slice(0, 7)}（預設）`}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-word' }}>{l.notes ?? ''}</td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', gap: 8 }}>
                    {l.license_url && (
                      <a href={l.license_url} target="_blank" rel="noopener noreferrer"
                         title="行照"
                         style={{ color: 'var(--blue)', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, textDecoration: 'none' }}>
                        <Paperclip size={12} />行照
                      </a>
                    )}
                    {l.receipt_url && (
                      <a href={l.receipt_url} target="_blank" rel="noopener noreferrer"
                         title="收據"
                         style={{ color: 'var(--blue)', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, textDecoration: 'none' }}>
                        <Paperclip size={12} />收據
                      </a>
                    )}
                    {!l.license_url && !l.receipt_url && <span style={{ color: 'var(--text3)' }}>—</span>}
                  </div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <InspectionRowActions log={l} vehicles={modalVehicles} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
