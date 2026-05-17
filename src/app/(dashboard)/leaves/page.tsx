import { createServiceClient } from '@/lib/supabase/service'
import LeaveFormModal from '@/components/LeaveFormModal'
import LeaveRowActions from '@/components/LeaveRowActions'
import { Paperclip } from 'lucide-react'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:  { label: '待簽核', cls: 'badge-amber' },
  approved: { label: '已核准', cls: 'badge-green' },
  rejected: { label: '已退回', cls: 'badge-red'   },
}
const TYPE_LABEL: Record<string, string> = {
  sick: '病假', personal: '事假', annual: '特休', other: '其他',
}

export default async function LeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; driver?: string }>
}) {
  const supabase = createServiceClient()
  const { status, driver } = await searchParams

  let q = supabase.from('driver_leaves')
    .select('*, drivers(name)')
    .order('start_date', { ascending: false })
    .limit(500)
  if (status) q = q.eq('status', status)
  if (driver) q = q.eq('driver_id', driver)

  const [{ data: leaves }, { data: drivers }] = await Promise.all([
    q,
    supabase.from('drivers').select('id, name').eq('status', 'active')
      .order('display_order', { ascending: true, nullsFirst: false }).order('name'),
  ])

  const list = leaves ?? []
  const pendingCount = list.filter((l: any) => l.status === 'pending').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <form method="GET" action="/leaves" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
          </span>
          <LeaveFormModal mode="create" drivers={drivers ?? []} />
        </div>
      </div>

      <div className="card">
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: 100 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 70 }} />
            <col />
            <col style={{ width: 90 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 110 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>起始日期</th>
              <th style={{ textAlign: 'center' }}>結束日期</th>
              <th style={{ textAlign: 'center' }}>司機</th>
              <th style={{ textAlign: 'center' }}>假別</th>
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
            {list.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>尚無資料</td></tr>
            ) : list.map((l: any) => {
              const st = STATUS_BADGE[l.status] ?? { label: l.status, cls: 'badge-blue' }
              return (
                <tr key={l.id}>
                  <td className="mono" style={{ textAlign: 'center' }}>{l.start_date}</td>
                  <td className="mono" style={{ textAlign: 'center' }}>{l.end_date}</td>
                  <td className="name" style={{ textAlign: 'center' }}>{l.drivers?.name ?? ''}</td>
                  <td style={{ textAlign: 'center' }}>{TYPE_LABEL[l.leave_type] ?? l.leave_type}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{l.hours != null ? Number(l.hours) : ''}</td>
                  <td style={{ fontSize: 12, textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-word' }}>{l.reason ?? ''}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                    {l.status === 'rejected' && l.reject_reason && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{l.reject_reason}</div>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>{l.reviewed_by ?? ''}</td>
                  <td style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-word' }}>{l.notes ?? ''}</td>
                  <td style={{ textAlign: 'center' }}>
                    {l.receipt_url
                      ? <a href={l.receipt_url} target="_blank" rel="noopener noreferrer"
                           style={{ color: 'var(--blue)', textDecoration: 'none', display: 'inline-flex' }}>
                          <Paperclip size={14} />
                        </a>
                      : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <LeaveRowActions
                      leave={{
                        id: l.id, driver_id: l.driver_id, leave_type: l.leave_type,
                        start_date: l.start_date, end_date: l.end_date,
                        hours: l.hours != null ? Number(l.hours) : null,
                        reason: l.reason, notes: l.notes, status: l.status,
                        receipt_url: l.receipt_url ?? null,
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
