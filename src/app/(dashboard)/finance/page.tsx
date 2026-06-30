import { ReceiptText, Wallet, Paperclip } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/service'
import SubNavTabs from '@/components/SubNavTabs'
import FixedExpenseFormModal from '@/components/FixedExpenseFormModal'
import FixedExpenseRowActions from '@/components/FixedExpenseRowActions'
import MiscFormModal from '@/components/MiscFormModal'
import MiscRowActions from '@/components/MiscRowActions'
import MiscDateFilter from '@/components/MiscDateFilter'
import MiscImportExport from '@/components/MiscImportExport'
import SortableTh from '@/components/SortableTh'

// 確保型別定義與 MiscFormModal.tsx 同步
export type MiscRow = {
  id:               string
  type:             'income' | 'expense'
  category:         string | null
  amount:           number
  description:      string | null
  transaction_date: string
  deduct_month:     string | null
  notes:            string | null
  receipt_url:      string | null
  payment_method:   string | null
  payment_status:   'paid' | 'pending'
  due_date:         string | null
  paid_at:          string | null
  driver_id:        string | null
  vehicle_id:       string | null
}

type TabKey = 'fixed' | 'misc'

const TABS = [
  { key: 'fixed' as const, label: '固定收支', icon: <ReceiptText size={14} strokeWidth={1.8} /> },
  { key: 'misc'  as const, label: '其他收支', icon: <Wallet size={14} strokeWidth={1.8} />      },
]

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sort?: string; dir?: string; type?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const tab: TabKey = sp.tab === 'misc' ? 'misc' : 'fixed'

  return (
    <div>
      <SubNavTabs<TabKey> basePath="/finance" tabs={TABS} activeTab={tab} />
      {tab === 'fixed'
        ? <FixedTab />
        : <MiscTab sortField={sp.sort ?? 'transaction_date'} ascending={(sp.dir ?? 'desc') === 'asc'} type={sp.type} from={sp.from} to={sp.to} />}
    </div>
  )
}

async function FixedTab() {
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
    <>
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
    </>
  )
}

async function MiscTab({
  sortField, ascending, type, from, to,
}: {
  sortField: string; ascending: boolean; type?: string; from?: string; to?: string
}) {
  const supabase = createServiceClient()

  // 1. 撈取資料並關聯 Drivers 與 Vehicles
  const [{ data: txs }, { data: drivers }, { data: vehicles }] = await Promise.all([
    supabase
      .from('misc_transactions')
      .select('*, drivers(name), vehicles(plate_number)')
      .order('transaction_date', { ascending: false })
      .limit(500),
    supabase.from('drivers').select('id, name').eq('status', 'active'),
    supabase.from('vehicles').select('id, plate_number'),
  ])
    
  if (type === 'income' || type === 'expense') /* filter handled below */ null
  
  // 處理 filter
  let filteredTxs = txs ?? []
  if (type === 'income' || type === 'expense') filteredTxs = filteredTxs.filter(t => t.type === type)
  if (from) filteredTxs = filteredTxs.filter(t => t.transaction_date >= from)
  if (to)   filteredTxs = filteredTxs.filter(t => t.transaction_date <= to)

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthly = (filteredTxs ?? []).filter(t => t.transaction_date >= monthStart)
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
  const sorted = [...filteredTxs].sort((a, b) => {
    const av = getKey(a), bv = getKey(b)
    if (av === bv) return 0
    if (typeof av === 'number' && typeof bv === 'number') return ascending ? av - bv : bv - av
    const cmp = String(av).localeCompare(String(bv), 'zh-Hant')
    return ascending ? cmp : -cmp
  })

  const hasFilter = !!(from || to || type)

  return (
    <>
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
          {/* 傳遞 drivers 與 vehicles 給 Modal */}
          <MiscFormModal 
             mode="create" 
             drivers={drivers ?? []} 
             vehicles={vehicles ?? []} 
          />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">其他收支紀錄</div>
          <div className="card-sub">{hasFilter ? `共 ${sorted.length} 筆` : '最近 500 筆'}</div>
        </div>
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: 40 }} />
            <col style={{ width: 60 }} />
          </colgroup>
          <thead>
            <tr>
              <SortableTh field="transaction_date" defaultField="transaction_date" defaultDir="desc" align="center">日期</SortableTh>
              <SortableTh field="type" defaultField="transaction_date" defaultDir="desc" align="center">類型</SortableTh>
              <SortableTh field="category" defaultField="transaction_date" defaultDir="desc" align="left">類別</SortableTh>
              <SortableTh field="description" defaultField="transaction_date" defaultDir="desc" align="left">說明</SortableTh>
              <th style={{ textAlign: 'center' }}>司機</th>
              <th style={{ textAlign: 'center' }}>車輛</th>
              <SortableTh field="amount" defaultField="transaction_date" defaultDir="desc" align="right">金額</SortableTh>
              <th style={{ textAlign: 'left' }}>狀態</th>
              <SortableTh field="deduct_month" defaultField="transaction_date" defaultDir="desc" align="center">扣帳年月</SortableTh>
              <th style={{ textAlign: 'center' }}>單據</th>
              <th style={{ textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!sorted.length ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>
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
                <td style={{ textAlign: 'center', fontSize: 12 }}>{t.drivers?.name ?? '—'}</td>
                <td style={{ textAlign: 'center', fontSize: 12 }}>{t.vehicles?.plate_number ?? '—'}</td>
                <td className="mono" style={{ color: t.type === 'income' ? 'var(--accent2)' : 'var(--red)', textAlign: 'right' }}>
                  {t.type === 'income' ? '+' : '−'}{Number(t.amount).toLocaleString()}
                </td>
                <td style={{ fontSize: 12, textAlign: 'left' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className={`badge ${t.payment_status === 'pending' ? 'badge-amber' : 'badge-green'}`}>
                      {t.payment_status === 'pending' ? '待支付' : '已支付'}
                    </span>
                  </div>
                </td>
                <td className="mono" style={{ color: t.deduct_month ? undefined : 'var(--text3)', textAlign: 'center' }}>
                  {t.deduct_month
                    ? String(t.deduct_month).slice(0, 7)
                    : `${String(t.transaction_date).slice(0, 7)}（預設）`}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {t.receipt_url
                    ? <a href={t.receipt_url} target="_blank" rel="noopener noreferrer" title="檢視單據"
                         style={{ color: 'var(--blue)', textDecoration: 'none', display: 'inline-flex' }}><Paperclip size={14} /></a>
                    : <span style={{ color: 'var(--text3)' }}>—</span>}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MiscRowActions 
                    tx={{
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
                      driver_id: t.driver_id ?? null,
                      vehicle_id: t.vehicle_id ?? null,
                    }} 
                    drivers={drivers ?? []}
                    vehicles={vehicles ?? []}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
