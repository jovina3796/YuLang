import { createServiceClient } from '@/lib/supabase/service'
import { Paperclip } from 'lucide-react'
import MaintenanceFormModal from '@/components/MaintenanceFormModal'
import MaintenanceRowActions from '@/components/MaintenanceRowActions'
import SortableTh from '@/components/SortableTh'

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>
}) {
  const supabase = createServiceClient()
  const { sort, dir } = await searchParams
  const sortField = sort ?? 'serviced_at'
  const ascending = (dir ?? 'desc') === 'asc'

  const today = new Date().toISOString().split('T')[0]
  const weekLater = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  const [{ data: logs }, { data: vehicles }] = await Promise.all([
    supabase
      .from('maintenance_logs')
      .select('*, vehicles(plate_number)')
      .order('serviced_at', { ascending: false })
      .limit(100),
    supabase.from('vehicles').select('id, plate_number').order('display_order', { ascending: true, nullsFirst: false }).order('plate_number'),
  ])

  // 收集歷史維修廠商名稱供下拉選單
  const { data: vendorRows } = await supabase
    .from('maintenance_logs')
    .select('vendor_name')
    .not('vendor_name', 'is', null)
  const vendorNames = Array.from(
    new Set((vendorRows ?? []).map((r: any) => r.vendor_name).filter(Boolean))
  ).sort((a, b) => String(a).localeCompare(String(b), 'zh-Hant'))

  const overdue  = logs?.filter(l => l.next_due_date && l.next_due_date < today) ?? []
  const upcoming = logs?.filter(l => l.next_due_date && l.next_due_date >= today && l.next_due_date <= weekLater) ?? []

  const getStatus = (next: string | null) => {
    if (!next) return { label: '正常', cls: 'badge-green' }
    if (next < today) return { label: '已逾期', cls: 'badge-red' }
    if (next <= weekLater) return { label: '即將到期', cls: 'badge-amber' }
    return { label: '正常', cls: 'badge-green' }
  }

  const getKey = (l: any): string | number => {
    switch (sortField) {
      case 'vehicle':            return l.vehicles?.plate_number ?? ''
      case 'type':               return l.type ?? ''
      case 'serviced_at':        return l.serviced_at ?? ''
      case 'vendor_name':        return l.vendor_name ?? ''
      case 'cost':               return l.cost ?? -1
      case 'mileage_at_service': return l.mileage_at_service ?? -1
      case 'next_due_date':      return l.next_due_date ?? '￿'
      case 'deduct_month':       return l.deduct_month ?? l.serviced_at ?? ''
      case 'receipt':            return l.receipt_url ? 1 : 0
      case 'status':             return getStatus(l.next_due_date).label
      default:                   return ''
    }
  }
  const sortedLogs = [...(logs ?? [])].sort((a, b) => {
    const av = getKey(a), bv = getKey(b)
    if (av === bv) return 0
    if (typeof av === 'number' && typeof bv === 'number') return ascending ? av - bv : bv - av
    const cmp = String(av).localeCompare(String(bv), 'zh-Hant')
    return ascending ? cmp : -cmp
  })

  return (
    <div>
      {(overdue.length > 0 || upcoming.length > 0) && (
        <div className="alert-row" style={{ marginBottom: 18 }}>
          ⚠{' '}
          {overdue.length > 0 && `${overdue.length} 筆保養已逾期`}
          {overdue.length > 0 && upcoming.length > 0 && '，'}
          {upcoming.length > 0 && `${upcoming.length} 筆本週即將到期`}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <MaintenanceFormModal vehicles={vehicles ?? []} vendorNames={vendorNames} mode="create" />
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">保養維修紀錄</div>
        </div>
        <table>
          <thead>
            <tr>
              <SortableTh field="vehicle" defaultField="serviced_at" defaultDir="desc" align="center">車牌</SortableTh>
              <SortableTh field="type" defaultField="serviced_at" defaultDir="desc" align="left">類型</SortableTh>
              <SortableTh field="serviced_at" defaultField="serviced_at" defaultDir="desc" align="center">保養日期</SortableTh>
              <SortableTh field="vendor_name" defaultField="serviced_at" defaultDir="desc" align="left">廠商</SortableTh>
              <SortableTh field="cost" defaultField="serviced_at" defaultDir="desc" align="right">費用</SortableTh>
              <SortableTh field="deduct_month" defaultField="serviced_at" defaultDir="desc" align="center">扣帳年月</SortableTh>
              <SortableTh field="mileage_at_service" defaultField="serviced_at" defaultDir="desc" align="right">里程</SortableTh>
              <SortableTh field="next_due_date" defaultField="serviced_at" defaultDir="desc" align="center">下次預定</SortableTh>
              <SortableTh field="receipt" defaultField="serviced_at" defaultDir="desc" align="center">單據</SortableTh>
              <SortableTh field="status" defaultField="serviced_at" defaultDir="desc" align="center">狀態</SortableTh>
              <th style={{ width: 80, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!sortedLogs.length ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>尚無資料</td></tr>
            ) : sortedLogs.map((l: any) => {
              const st = getStatus(l.next_due_date)
              const dueColor = l.next_due_date < today ? 'var(--red)'
                : l.next_due_date <= weekLater ? 'var(--amber2)' : 'var(--accent2)'
              return (
                <tr key={l.id}>
                  <td className="mono" style={{ textAlign: 'center' }}>{l.vehicles?.plate_number ?? ''}</td>
                  <td style={{ textAlign: 'left' }}>{l.type}</td>
                  <td className="mono" style={{ textAlign: 'center' }}>{l.serviced_at}</td>
                  <td style={{ textAlign: 'left' }}>{l.vendor_name ?? ''}</td>
                  <td className="mono" style={{ color: 'var(--amber2)', textAlign: 'right' }}>{l.cost?.toLocaleString() ?? ''}</td>
                  <td className="mono" style={{ color: l.deduct_month ? undefined : 'var(--text3)', textAlign: 'center' }}>
                    {l.deduct_month
                      ? String(l.deduct_month).slice(0, 7)
                      : `${String(l.serviced_at).slice(0, 7)}（預設）`}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>{l.mileage_at_service?.toLocaleString() ?? ''} km</td>
                  <td className="mono" style={{ color: l.next_due_date ? dueColor : 'var(--text3)', textAlign: 'center' }}>
                    {l.next_due_date ?? ''}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {l.receipt_url
                      ? <a href={l.receipt_url} target="_blank" rel="noopener noreferrer"
                           style={{ color: 'var(--blue)', textDecoration: 'none', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Paperclip size={13} /> 開啟</a>
                      : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <MaintenanceRowActions
                      log={{
                        id: l.id,
                        vehicle_id: l.vehicle_id,
                        type: l.type,
                        vendor_name: l.vendor_name ?? null,
                        cost: l.cost ?? null,
                        mileage_at_service: l.mileage_at_service ?? null,
                        serviced_at: l.serviced_at,
                        next_due_date: l.next_due_date ?? null,
                        deduct_month: l.deduct_month ?? null,
                        notes: l.notes ?? null,
                        receipt_url: l.receipt_url ?? null,
                      }}
                      vehicles={vehicles ?? []}
                      vendorNames={vendorNames}
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
