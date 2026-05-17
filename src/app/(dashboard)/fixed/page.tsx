import { createServiceClient } from '@/lib/supabase/service'
import FixedExpenseFormModal from '@/components/FixedExpenseFormModal'
import FixedExpenseRowActions from '@/components/FixedExpenseRowActions'

export default async function FixedExpensesPage() {
  const supabase = createServiceClient()

  const [{ data: rows }, { data: vehicles }] = await Promise.all([
    supabase
      .from('fixed_expenses')
      .select('*, vehicles(plate_number)')
      .order('active', { ascending: false })
      .order('name'),
    supabase
      .from('vehicles')
      .select('id, plate_number')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('plate_number'),
  ])

  const list = rows ?? []
  const activeRows = list.filter((r: any) => r.active)
  const monthlyTotal = activeRows.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>每月固定支出總額</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--amber2)' }}>
            {monthlyTotal > 0 ? monthlyTotal.toLocaleString() : ''}
          </div>
        </div>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>啟用中項目數</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--purple)' }}>
            {activeRows.length}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <FixedExpenseFormModal vehicles={vehicles ?? []} mode="create" />
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">固定收支</div>
            <div className="card-sub">每月自動納入扣項統計</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>項目</th>
              <th>類別</th>
              <th>金額</th>
              <th>對應車輛</th>
              <th>啟用區間</th>
              <th>狀態</th>
              <th>備註</th>
              <th style={{ width: 80 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!list.length ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>尚無資料</td></tr>
            ) : list.map((r: any) => {
              const range = [r.start_month?.slice(0, 7), r.end_month?.slice(0, 7)].filter(Boolean).join(' ~ ')
              return (
                <tr key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
                  <td>{r.name}</td>
                  <td>{r.category ?? ''}</td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--amber2)' }}>
                    {Number(r.amount).toLocaleString()}
                  </td>
                  <td className="mono" style={{ textAlign: 'center' }}>{r.vehicles?.plate_number ?? ''}</td>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--text3)' }}>{range || '不限'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${r.active ? 'badge-green' : 'badge-blue'}`}>
                      {r.active ? '啟用' : '停用'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-word' }}>{r.notes ?? ''}</td>
                  <td>
                    <FixedExpenseRowActions
                      row={{
                        id:          r.id,
                        name:        r.name,
                        category:    r.category ?? null,
                        amount:      Number(r.amount),
                        vehicle_id:  r.vehicle_id ?? null,
                        notes:       r.notes ?? null,
                        active:      r.active,
                        start_month: r.start_month ?? null,
                        end_month:   r.end_month   ?? null,
                      }}
                      vehicles={vehicles ?? []}
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
