import { createServiceClient } from '@/lib/supabase/service'
import OvertimeFormModal from '@/components/OvertimeFormModal'
import OvertimeRowActions from '@/components/OvertimeRowActions'
import { Paperclip } from 'lucide-react'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:  { label: '待簽核', cls: 'badge-amber' },
  approved: { label: '已核准', cls: 'badge-green' },
  rejected: { label: '已退回', cls: 'badge-red'   },
}

export default async function OvertimesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; driver?: string }>
}) {
  const supabase = createServiceClient()
  const { status, driver } = await searchParams

  let q = supabase.from('driver_overtimes')
    .select('*, drivers(name)')
    .order('work_date', { ascending: false })
    .limit(500)
  if (status) q = q.eq('status', status)
  if (driver) q = q.eq('driver_id', driver)

  const [{ data: list }, { data: drivers }] = await Promise.all([
    q,
    supabase.from('drivers').select('id, name').eq('status', 'active')
      .order('display_order', { ascending: true, nullsFirst: false }).order('name'),
  ])

  const rows = list ?? []
  const pendingCount = rows.filter((r: any) => r.status === 'pending').length
  const approvedHours = rows.filter((r: any) => r.status === 'approved')
    .reduce((s: number, r: any) => s + Number(r.hours ?? 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <form method="GET" action="/overtimes" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select name="status" defaultValue={status ?? ''} className="input" style={{ height: 30, padding: '2px 10px', fontSize: 12, minWidth: 130 }}>
            <option value="">全部狀態</option>
            <option value="pending">待簽核</option>
            <option value="approved">已核准</option>
            <option value="rejected">已退回</option>
          </select>
          <select name="driver" defaultValue={driver ?? ''} className="input" style={{ height: 30, padding: '2px 10px', fontSize: 12, minWidth: 150 }}>
            <option value="">全部司機</option>
            {(drivers ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button type="submit" className="btn btn-sm">查詢</button>
        </form>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            待簽核 <span className="mono" style={{ color: 'var(--amber2)' }}>{pendingCount}</span> 筆
            已核准時數 <span className="mono" style={{ color: 'var(--accent2)' }}>{approvedHours}</span>
          </span>
          <OvertimeFormModal mode="create" drivers={drivers ?? []} />
        </div>
      </div>

      <div className="card">
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: 110 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 80 }} />
            <col />
            <col style={{ width: 90 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 110 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>日期</th>
              <th style={{ textAlign: 'center' }}>司機</th>
              <th style={{ textAlign: 'right' }}>時數</th>
              <th style={{ textAlign: 'left' }}>事由</th>
              <th style={{ textAlign: 'center' }}>狀態</th>
              <th style={{ textAlign: 'center' }}>審核人員</th>
              <th style={{ textAlign: 'left' }}>備註</th>
              <th style={{ width: 60, textAlign: 'center' }}>單據</th>
              <th style={{ width: 110, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>尚無資料</td></tr>
            ) : rows.map((r: any) => {
              const st = STATUS_BADGE[r.status] ?? { label: r.status, cls: 'badge-blue' }
              return (
                <tr key={r.id}>
                  <td className="mono" style={{ textAlign: 'center' }}>{r.work_date}</td>
                  <td className="name" style={{ textAlign: 'center' }}>{r.drivers?.name ?? ''}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{Number(r.hours)}</td>
                  <td style={{ fontSize: 12, textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-word' }}>{r.reason ?? ''}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                    {r.status === 'rejected' && r.reject_reason && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{r.reject_reason}</div>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>{r.reviewed_by ?? ''}</td>
                  <td style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-word' }}>{r.notes ?? ''}</td>
                  <td style={{ textAlign: 'center' }}>
                    {r.receipt_url
                      ? <a href={r.receipt_url} target="_blank" rel="noopener noreferrer"
                           style={{ color: 'var(--blue)', textDecoration: 'none', display: 'inline-flex' }}>
                          <Paperclip size={14} />
                        </a>
                      : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <OvertimeRowActions
                      ot={{
                        id: r.id, driver_id: r.driver_id, work_date: r.work_date,
                        hours: Number(r.hours), reason: r.reason, notes: r.notes,
                        status: r.status, receipt_url: r.receipt_url ?? null,
                      }}
                      drivers={drivers ?? []} reviewer={null}
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
