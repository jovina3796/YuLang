import { createServiceClient } from '@/lib/supabase/service'
import FuelFormModal from '@/components/FuelFormModal'
import FuelRowActions from '@/components/FuelRowActions'
import FuelDateFilter from '@/components/FuelDateFilter'
import FuelImportExport from '@/components/FuelImportExport'
import PaymentAliasFormModal from '@/components/PaymentAliasFormModal'
import PaymentAliasRowActions from '@/components/PaymentAliasRowActions'
import SortableTh from '@/components/SortableTh'
import { Paperclip } from 'lucide-react'

export default async function FuelPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; from?: string; to?: string; vehicle?: string }>
}) {
  const supabase = createServiceClient()
  const { sort, dir, from, to, vehicle } = await searchParams
  const sortField = sort ?? 'logged_at'
  const ascending = (dir ?? 'desc') === 'asc'

  // Use TW timezone to determine current month so server (UTC) doesn't roll
  // over a day early/late at month boundaries.
  const twNowParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date())
  const twYear  = Number(twNowParts.find(p => p.type === 'year')!.value)
  const twMonth = Number(twNowParts.find(p => p.type === 'month')!.value)
  const monthStart    = new Date(`${twYear}-${String(twMonth).padStart(2, '0')}-01T00:00:00+08:00`).toISOString()
  const nextMonthStart = new Date(`${twMonth === 12 ? twYear + 1 : twYear}-${String(twMonth === 12 ? 1 : twMonth + 1).padStart(2, '0')}-01T00:00:00+08:00`).toISOString()

  let q = supabase
    .from('fuel_logs')
    .select('*, vehicles(plate_number)')
    .order('logged_at', { ascending: false })
    .limit(500)
  if (from)    q = q.gte('logged_at', new Date(`${from}T00:00:00+08:00`).toISOString())
  if (to)      q = q.lte('logged_at', new Date(`${to}T23:59:59.999+08:00`).toISOString())
  if (vehicle) q = q.eq('vehicle_id', vehicle)

  const [{ data: logs }, { data: vehicles }, { data: aliases }, { data: monthlyLogs }] = await Promise.all([
    q,
    supabase.from('vehicles').select('id, plate_number').order('display_order', { ascending: true, nullsFirst: false }).order('plate_number'),
    supabase.from('payment_aliases').select('id, alias, target, created_at').order('created_at', { ascending: false }),
    supabase.from('fuel_logs')
      .select('total_cost')
      .gte('logged_at', monthStart)
      .lt('logged_at', nextMonthStart),
  ])

  const monthly = monthlyLogs ?? []
  const totalCost = monthly.reduce((s, l: any) => s + (l.total_cost ?? 0), 0)

  const getKey = (l: any): string | number => {
    switch (sortField) {
      case 'logged_at':         return l.logged_at ?? ''
      case 'vehicle':           return l.vehicles?.plate_number ?? ''
      case 'mileage_at_refuel': return l.mileage_at_refuel ?? -1
      case 'total_cost':        return l.total_cost ?? -1
      case 'payment_method':    return l.payment_method ?? ''
      default:                  return ''
    }
  }
  const sortedLogs = [...(logs ?? [])].sort((a, b) => {
    const av = getKey(a), bv = getKey(b)
    if (av === bv) return 0
    if (typeof av === 'number' && typeof bv === 'number') return ascending ? av - bv : bv - av
    const cmp = String(av).localeCompare(String(bv), 'zh-Hant')
    return ascending ? cmp : -cmp
  })

  const hasFilter = !!(from || to || vehicle)
  const filteredSubtotal = sortedLogs.reduce((s, l: any) => s + (l.total_cost ?? 0), 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 14, marginBottom: 20 }}>
        {[
          { label: '本月加油費',   value: totalCost > 0 ? totalCost.toLocaleString() : '',   color: 'var(--amber2)' },
          { label: '本月加油筆數', value: monthly.length.toString(),                            color: 'var(--purple)' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--mono)', color: k.color }}>{k.value}</div>
          </div>
        ))}

        <div className="card" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>付款別名</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>LINE 加油回報輸入關鍵字 → 寫入的付款方式（最長關鍵字優先）</div>
            </div>
            <PaymentAliasFormModal mode="create" />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 110, border: '1px solid var(--border)', borderRadius: 6 }}>
            <table style={{ fontSize: 12 }}>
              <tbody>
                {!(aliases ?? []).length ? (
                  <tr><td style={{ textAlign: 'center', color: 'var(--text3)', padding: 16 }}>尚無資料</td></tr>
                ) : (aliases ?? []).map(a => (
                  <tr key={a.id}>
                    <td style={{ textAlign: 'left', padding: '4px 10px', whiteSpace: 'nowrap' }}>{a.alias}</td>
                    <td style={{ textAlign: 'left', padding: '4px 10px', color: 'var(--text3)' }}>→ {a.target}</td>
                    <td style={{ textAlign: 'right', padding: '4px 10px', width: 70 }}>
                      <PaymentAliasRowActions row={{ id: a.id, alias: a.alias, target: a.target }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <FuelDateFilter vehicles={vehicles ?? []} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasFilter && (
            <span style={{ fontSize: 13, color: 'var(--text2)', marginRight: 4 }}>
              金額小計：<span className="mono" style={{ color: 'var(--amber2)', fontWeight: 600 }}>${filteredSubtotal.toLocaleString()}</span>
            </span>
          )}
          <FuelImportExport />
          <FuelFormModal vehicles={vehicles ?? []} mode="create" />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">加油紀錄</div>
          <div className="card-sub">{hasFilter ? `共 ${sortedLogs.length} 筆` : '最近 500 筆'}</div>
        </div>
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 80 }} />
          </colgroup>
          <thead>
            <tr>
              <SortableTh field="logged_at" defaultField="logged_at" defaultDir="desc" align="center">日期</SortableTh>
              <SortableTh field="vehicle" defaultField="logged_at" defaultDir="desc" align="center">車輛</SortableTh>
              <SortableTh field="mileage_at_refuel" defaultField="logged_at" defaultDir="desc" align="right">目前里程(km)</SortableTh>
              <SortableTh field="total_cost" defaultField="logged_at" defaultDir="desc" align="right">金額</SortableTh>
              <SortableTh field="payment_method" defaultField="logged_at" defaultDir="desc" align="left">付款方式</SortableTh>
              <th style={{ textAlign: 'left' }}>備註</th>
              <th style={{ textAlign: 'center' }}>單據</th>
              <th style={{ width: 80, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!sortedLogs.length ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>尚無資料</td></tr>
            ) : sortedLogs.map((l: any) => (
              <tr key={l.id}>
                <td className="mono" style={{ textAlign: 'center' }}>{new Date(l.logged_at).toLocaleDateString('zh-TW', { year: 'numeric', month:'2-digit', day:'2-digit', timeZone: 'Asia/Taipei' })}</td>
                <td className="mono" style={{ textAlign: 'center' }}>{l.vehicles?.plate_number ?? ''}</td>
                <td className="mono" style={{ textAlign: 'right' }}>{l.mileage_at_refuel?.toLocaleString() ?? ''}</td>
                <td className="mono" style={{ color: 'var(--amber2)', textAlign: 'right' }}>{l.total_cost?.toLocaleString() ?? ''}</td>
                <td style={{ textAlign: 'left' }}>{l.payment_method ?? ''}</td>
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
                  <FuelRowActions
                    log={{
                      id: l.id,
                      vehicle_id: l.vehicle_id,
                      driver_id: l.driver_id ?? null,
                      liters: l.liters ?? null,
                      price_per_liter: l.price_per_liter ?? null,
                      total_cost: l.total_cost ?? null,
                      mileage_at_refuel: l.mileage_at_refuel ?? null,
                      station_name: l.station_name ?? null,
                      payment_method: l.payment_method ?? null,
                      notes: l.notes ?? null,
                      logged_at: l.logged_at,
                      receipt_url: l.receipt_url ?? null,
                    }}
                    vehicles={vehicles ?? []}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
