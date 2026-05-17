import { createServiceClient } from '@/lib/supabase/service'
import { Paperclip } from 'lucide-react'
import ClaimFormModal from '@/components/ClaimFormModal'
import ClaimRowActions from '@/components/ClaimRowActions'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:  { label: '待簽核', cls: 'badge-amber' },
  approved: { label: '已核准', cls: 'badge-blue'  },
  rejected: { label: '已退回', cls: 'badge-red'   },
  paid:     { label: '已支付', cls: 'badge-green' },
}

const TYPE_LABEL: Record<string, string> = {
  parking: '停車費', fine: '罰單', supply: '消耗品', other: '其他',
}

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; driver?: string }>
}) {
  const supabase = createServiceClient()
  const { status, driver } = await searchParams

  let q = supabase
    .from('driver_claims')
    .select('*, drivers(name)')
    .order('occurred_at', { ascending: false })
    .limit(500)
  if (status) q = q.eq('status', status)
  if (driver) q = q.eq('driver_id', driver)

  const [{ data: claims }, { data: drivers }] = await Promise.all([
    q,
    supabase.from('drivers')
      .select('id, name').eq('status', 'active')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('name'),
  ])

  const list = claims ?? []
  const pendingTotal = list.filter((c: any) => c.status === 'pending').reduce((s, c: any) => s + Number(c.amount ?? 0), 0)
  const approvedTotal = list.filter((c: any) => c.status === 'approved').reduce((s, c: any) => s + Number(c.amount ?? 0), 0)

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <form method="GET" action="/claims" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select name="status" defaultValue={status ?? ''} className="input" style={{ height: 30, padding: '2px 10px', fontSize: 12, minWidth: 130 }}>
            <option value="">全部狀態</option>
            <option value="pending">待簽核</option>
            <option value="approved">已核准</option>
            <option value="rejected">已退回</option>
            <option value="paid">已支付</option>
          </select>
          <select name="driver" defaultValue={driver ?? ''} className="input" style={{ height: 30, padding: '2px 10px', fontSize: 12, minWidth: 150 }}>
            <option value="">全部司機</option>
            {(drivers ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button type="submit" className="btn btn-sm">查詢</button>
        </form>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            待簽核 <span className="mono" style={{ color: 'var(--amber2)' }}>{pendingTotal.toLocaleString()}</span>
            已核准未付 <span className="mono" style={{ color: 'var(--blue)' }}>{approvedTotal.toLocaleString()}</span>
          </span>
          <ClaimFormModal mode="create" drivers={drivers ?? []} />
        </div>
      </div>

      <div className="card">
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
            <col />
            <col style={{ width: '4%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>發生日期</th>
              <th>司機</th>
              <th>類型</th>
              <th>說明</th>
              <th>金額</th>
              <th>狀態</th>
              <th>審核人員</th>
              <th>備註</th>
              <th>單據</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>尚無資料</td></tr>
            ) : list.map((c: any) => {
              const st = STATUS_BADGE[c.status] ?? { label: c.status, cls: 'badge-blue' }
              return (
                <tr key={c.id}>
                  <td className="mono" style={{ textAlign: 'center' }}>{c.occurred_at}</td>
                  <td className="name" style={{ textAlign: 'center' }}>{c.drivers?.name ?? ''}</td>
                  <td style={{ textAlign: 'left' }}>{TYPE_LABEL[c.claim_type] ?? c.claim_type}</td>
                  <td style={{ textAlign: 'left' }}>{c.category ?? ''}</td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--red)' }}>
                    {Number(c.amount ?? 0).toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                    {c.status === 'rejected' && c.reject_reason && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{c.reject_reason}</div>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>{c.reviewed_by ?? ''}</td>
                  <td style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-word' }}>{c.notes ?? ''}</td>
                  <td style={{ textAlign: 'center' }}>
                    {c.receipt_url
                      ? <a href={c.receipt_url} target="_blank" rel="noopener noreferrer"
                           style={{ color: 'var(--blue)', textDecoration: 'none', display: 'inline-flex' }}>
                          <Paperclip size={14} />
                        </a>
                      : <span style={{ color: 'var(--text3)' }}></span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <ClaimRowActions
                      claim={{
                        id: c.id, driver_id: c.driver_id,
                        claim_type: c.claim_type, category: c.category,
                        amount: Number(c.amount), occurred_at: c.occurred_at,
                        receipt_url: c.receipt_url, notes: c.notes,
                        status: c.status,
                      }}
                      drivers={drivers ?? []}
                      reviewer={null}
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
