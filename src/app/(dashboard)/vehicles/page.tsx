import { createServiceClient } from '@/lib/supabase/service'
import VehicleFormModal from '@/components/VehicleFormModal'
import VehicleRowActions from '@/components/VehicleRowActions'
import SortableTh from '@/components/SortableTh'

const STATUS: Record<string, { label: string; cls: string }> = {
  active:      { label: '正常', cls: 'badge-green' },
  maintenance: { label: '維修', cls: 'badge-red'   },
  retired:     { label: '退役', cls: 'badge-blue'  },
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>
}) {
  const supabase = createServiceClient()
  const { sort, dir } = await searchParams
  const sortField = sort ?? 'plate_number'
  const ascending = (dir ?? 'asc') === 'asc'

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('plate_number')

  const today    = new Date().toISOString().split('T')[0]
  const monthOut = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  const getKey = (v: any): string | number => {
    switch (sortField) {
      case 'plate_number':         return v.plate_number ?? ''
      case 'category':             return v.category ?? ''
      case 'model':                return v.model ?? ''
      case 'manufacture_date':     return v.manufacture_date ?? ''
      case 'mileage':              return v.mileage ?? -1
      case 'last_inspection_date': return v.last_inspection_date ?? '￿'
      case 'next_inspection_date': return v.next_inspection_date ?? '￿'
      case 'status':               return v.status ?? ''
      case 'display_order':        return v.display_order ?? Number.MAX_SAFE_INTEGER
      default:                     return ''
    }
  }
  const sortedVehicles = [...(vehicles ?? [])].sort((a, b) => {
    const av = getKey(a), bv = getKey(b)
    if (av === bv) return 0
    if (typeof av === 'number' && typeof bv === 'number') return ascending ? av - bv : bv - av
    const cmp = String(av).localeCompare(String(bv), 'zh-Hant')
    return ascending ? cmp : -cmp
  })

  const expiringSoon = (vehicles ?? []).filter(v =>
    v.next_inspection_date && v.next_inspection_date <= monthOut && v.status !== 'retired'
  )

  return (
    <div>
      {expiringSoon.length > 0 && (
        <div className="alert-row" style={{ marginBottom: 16 }}>
          ⚠ {expiringSoon.length} 輛車輛驗車即將到期（30 天內）：
          {expiringSoon.map(v => `${v.plate_number}（${v.next_inspection_date}）`).join('、')}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <VehicleFormModal mode="create" />
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">車輛清單</div>
            <div className="card-sub">共 {vehicles?.length ?? 0} 輛</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <SortableTh field="plate_number"         defaultField="plate_number" defaultDir="asc" align="center">車牌號碼</SortableTh>
              <SortableTh field="category"             defaultField="plate_number" defaultDir="asc" align="center">車輛類別</SortableTh>
              <SortableTh field="model"                defaultField="plate_number" defaultDir="asc" align="center">車型</SortableTh>
              <SortableTh field="manufacture_date"     defaultField="plate_number" defaultDir="asc" align="center">出廠年月</SortableTh>
              <SortableTh field="mileage"              defaultField="plate_number" defaultDir="asc" align="right">里程數</SortableTh>
              <SortableTh field="last_inspection_date" defaultField="plate_number" defaultDir="asc" align="right">驗車日期</SortableTh>
              <SortableTh field="next_inspection_date" defaultField="plate_number" defaultDir="asc" align="right">下次驗車</SortableTh>
              <SortableTh field="status"               defaultField="plate_number" defaultDir="asc" align="center">狀態</SortableTh>
              <th style={{ width: 80, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!sortedVehicles.length ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>尚無資料</td></tr>
            ) : sortedVehicles.map((v: any) => {
              const st  = STATUS[v.status] ?? { label: v.status, cls: 'badge-blue' }
              const next = v.next_inspection_date as string | null
              const nextColor = !next ? 'var(--text3)'
                : next < today    ? 'var(--red)'
                : next <= monthOut ? 'var(--amber2)'
                : 'var(--accent2)'
              const manuLabel = v.manufacture_date ? v.manufacture_date.slice(0, 7) : ''
              return (
                <tr key={v.id}>
                  <td className="mono" style={{ textAlign: 'center' }}>{v.plate_number}</td>
                  <td style={{ textAlign: 'center' }}>{v.category ?? ''}</td>
                  <td style={{ textAlign: 'center' }}>{v.model ?? ''}</td>
                  <td className="mono" style={{ textAlign: 'center' }}>{manuLabel}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{v.mileage.toLocaleString()} km</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{v.last_inspection_date ?? ''}</td>
                  <td className="mono" style={{ color: nextColor, textAlign: 'right' }}>{next ?? ''}</td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <VehicleRowActions
                      vehicle={{
                        id:                   v.id,
                        plate_number:         v.plate_number,
                        category:             v.category ?? null,
                        model:                v.model ?? null,
                        manufacture_date:     v.manufacture_date ?? null,
                        mileage:              v.mileage,
                        last_inspection_date: v.last_inspection_date ?? null,
                        next_inspection_date: v.next_inspection_date ?? null,
                        status:               v.status,
                        display_order:        v.display_order ?? null,
                      }}
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
