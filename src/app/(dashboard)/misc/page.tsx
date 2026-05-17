import { createServiceClient } from '@/lib/supabase/service'
import { Paperclip } from 'lucide-react'
import MiscFormModal from '@/components/MiscFormModal'
import MiscRowActions from '@/components/MiscRowActions'
import MiscDateFilter from '@/components/MiscDateFilter'
import MiscImportExport from '@/components/MiscImportExport'
import SortableTh from '@/components/SortableTh'

export default async function MiscPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; type?: string; from?: string; to?: string }>
}) {
  const supabase = createServiceClient()
  const { sort, dir, type, from, to } = await searchParams
  const sortField = sort ?? 'transaction_date'
  const ascending = (dir ?? 'desc') === 'asc'

  let q = supabase.from('misc_transactions').select('*').order('transaction_date', { ascending: false }).limit(500)
  if (type === 'income' || type === 'expense') q = q.eq('type', type)
  if (from) q = q.gte('transaction_date', from)
  if (to)   q = q.lte('transaction_date', to)
  const { data: txs } = await q

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthly = (txs ?? []).filter(t => t.transaction_date >= monthStart)
  const monthIncome  = monthly.filter(t => t.type === 'income') .reduce((s, t) => s + (t.amount ?? 0), 0)
  const monthExpense = monthly.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount ?? 0), 0)
  const monthNet     = monthIncome - monthExpense

  const getKey = (t: any): string | number => {
    switch (sortField) {
      case 'transaction_date': return t.transaction_date ?? ''
      case 'type':             return t.type ?? ''
      case 'category':         return t.category ?? ''
      case 'amount':           return t.amount ?? -1
      case 'description':      return t.description ?? ''
      case 'deduct_month':     return t.deduct_month ?? t.transaction_date ?? ''
      default:                 return ''
    }
  }
  const sorted = [...(txs ?? [])].sort((a, b) => {
    const av = getKey(a), bv = getKey(b)
    if (av === bv) return 0
    if (typeof av === 'number' && typeof bv === 'number') return ascending ? av - bv : bv - av
    const cmp = String(av).localeCompare(String(bv), 'zh-Hant')
    return ascending ? cmp : -cmp
  })

  const hasFilter = !!(from || to || type)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: '本月其他收入', value: monthIncome  > 0 ? monthIncome.toLocaleString()  : '', color: 'var(--accent2)' },
          { label: '本月其他支出', value: monthExpense > 0 ? monthExpense.toLocaleString() : '', color: 'var(--red)' },
          {
            label: '本月淨額',
            value: monthly.length > 0 ? monthNet.toLocaleString() : '',
            color: monthNet >= 0 ? 'var(--accent2)' : 'var(--red)',
          },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--mono)', color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <MiscDateFilter />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <MiscImportExport />
          <MiscFormModal mode="create" />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">其他收支紀錄</div>
          <div className="card-sub">{hasFilter ? `共 ${sorted.length} 筆` : '最近 500 筆'}</div>
        </div>
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col />
            <col style={{ width: 60 }} />
            <col style={{ width: 80 }} />
          </colgroup>
          <thead>
            <tr>
              <SortableTh field="transaction_date" defaultField="transaction_date" defaultDir="desc" align="center">日期</SortableTh>
              <SortableTh field="type" defaultField="transaction_date" defaultDir="desc" align="center">類型</SortableTh>
              <SortableTh field="category" defaultField="transaction_date" defaultDir="desc" align="left">類別</SortableTh>
              <SortableTh field="description" defaultField="transaction_date" defaultDir="desc" align="left">說明</SortableTh>
              <SortableTh field="amount" defaultField="transaction_date" defaultDir="desc" align="right">金額</SortableTh>
              <th style={{ textAlign: 'left' }}>付款狀態</th>
              <SortableTh field="deduct_month" defaultField="transaction_date" defaultDir="desc" align="center">扣帳年月</SortableTh>
              <th style={{ textAlign: 'left' }}>備註</th>
              <th style={{ textAlign: 'center' }}>單據</th>
              <th style={{ textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!sorted.length ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>
                  尚無資料
                </td>
              </tr>
            ) : sorted.map((t: any) => (
              <tr key={t.id}>
                <td className="mono" style={{ textAlign: 'center' }}>{t.transaction_date}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`badge ${t.type === 'income' ? 'badge-green' : 'badge-red'}`}>
                    {t.type === 'income' ? '收入' : '支出'}
                  </span>
                </td>
                <td style={{ textAlign: 'left' }}>{t.category ?? ''}</td>
                <td style={{ textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-word' }}>{t.description ?? ''}</td>
                <td className="mono" style={{ color: t.type === 'income' ? 'var(--accent2)' : 'var(--red)', textAlign: 'right' }}>
                  {t.type === 'income' ? '+' : '−'}{Number(t.amount).toLocaleString()}
                </td>
                <td style={{ fontSize: 12, textAlign: 'left' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className={`badge ${t.payment_status === 'pending' ? 'badge-amber' : 'badge-green'}`}>
                      {t.payment_status === 'pending' ? '待支付' : '已支付'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t.payment_method ?? ''}</span>
                  </div>
                </td>
                <td className="mono" style={{ color: t.deduct_month ? undefined : 'var(--text3)', textAlign: 'center' }}>
                  {t.deduct_month
                    ? String(t.deduct_month).slice(0, 7)
                    : `${String(t.transaction_date).slice(0, 7)}（預設）`}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-word' }}>{t.notes ?? ''}</td>
                <td style={{ textAlign: 'center' }}>
                  {t.receipt_url
                    ? <a href={t.receipt_url} target="_blank" rel="noopener noreferrer" title="檢視單據"
                         style={{ color: 'var(--blue)', textDecoration: 'none', display: 'inline-flex' }}><Paperclip size={14} /></a>
                    : <span style={{ color: 'var(--text3)' }}>—</span>}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MiscRowActions tx={{
                    id: t.id,
                    type: t.type,
                    category: t.category ?? null,
                    amount: Number(t.amount),
                    description: t.description ?? null,
                    transaction_date: t.transaction_date,
                    deduct_month: t.deduct_month ?? null,
                    notes: t.notes ?? null,
                    receipt_url: t.receipt_url ?? null,
                    payment_method: t.payment_method ?? null,
                    payment_status: (t.payment_status ?? 'paid') as 'paid' | 'pending',
                    due_date: t.due_date ?? null,
                    paid_at: t.paid_at ?? null,
                  }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
