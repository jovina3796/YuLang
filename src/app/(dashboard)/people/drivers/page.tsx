import { createServiceClient } from '@/lib/supabase/service'
import DriverFormModal from '@/components/DriverFormModal'
import DriverRowActions from '@/components/DriverRowActions'
import SortableTh from '@/components/SortableTh'

const DRIVER_STATUS: Record<string, { label: string; cls: string }> = {
  active:   { label: '在職', cls: 'badge-green' },
  inactive: { label: '離職', cls: 'badge-red'   },
  leave:    { label: '請假', cls: 'badge-amber' },
}

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>
}) {
  const sp = await searchParams
  const sortField = sp.sort ?? 'name'
  const ascending = (sp.dir ?? 'asc') === 'asc'

  const supabase = createServiceClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: drivers } = await supabase
    .from('drivers')
    .select('*')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('name')

  const { data: vehiclesRaw } = await supabase
    .from('vehicles')
    .select('id, plate_number')
    .eq('status', 'active')
    .order('plate_number')
  const vehicles = (vehiclesRaw ?? []) as { id: string; plate_number: string }[]

  const { data: tripStats } = await supabase
    .from('trips')
    .select('driver_id')
    .gte('departed_at', monthStart)

  const countByDriver: Record<string, number> = {}
  tripStats?.forEach(t => {
    countByDriver[t.driver_id] = (countByDriver[t.driver_id] ?? 0) + 1
  })

  const getKey = (d: any): string | number => {
    switch (sortField) {
      case 'employee_no':         return d.employee_no ?? ''
      case 'name':                return d.name ?? ''
      case 'phone':               return d.phone ?? ''
      case 'license_type':        return d.license_type ?? ''
      case 'license_renewal':     return d.license_renewal_date ?? ''
      case 'trip_count':          return countByDriver[d.id] ?? 0
      case 'line':                return d.line_user_id ? 1 : 0
      case 'status':              return d.status ?? ''
      default:                    return ''
    }
  }
  const sortedDrivers = [...(drivers ?? [])].sort((a, b) => {
    const av = getKey(a), bv = getKey(b)
    if (av === bv) return 0
    if (typeof av === 'number' && typeof bv === 'number') return ascending ? av - bv : bv - av
    const cmp = String(av).localeCompare(String(bv), 'zh-Hant')
    return ascending ? cmp : -cmp
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <DriverFormModal vehicles={vehicles} mode="create" />
      </div>
      <div className="card">
        <div className="card-head">
          <div className="card-title">司機資料</div>
        </div>
        <table>
          <thead>
            <tr>
              <SortableTh field="employee_no" defaultField="name" defaultDir="asc" align="center">員工編號</SortableTh>
              <SortableTh field="name" defaultField="name" defaultDir="asc" align="center">姓名</SortableTh>
              <SortableTh field="phone" defaultField="name" defaultDir="asc" align="right">手機</SortableTh>
              <SortableTh field="license_type" defaultField="name" defaultDir="asc" align="center">駕照類別</SortableTh>
              <SortableTh field="license_renewal" defaultField="name" defaultDir="asc" align="center">駕照審驗日期</SortableTh>
              <SortableTh field="line" defaultField="name" defaultDir="asc" align="center">LINE 綁定</SortableTh>
              <SortableTh field="status" defaultField="name" defaultDir="asc" align="center">狀態</SortableTh>
              <th style={{ width: 80, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!sortedDrivers.length ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>尚無資料</td></tr>
            ) : sortedDrivers.map(d => {
              const st = DRIVER_STATUS[d.status] ?? { label: d.status, cls: 'badge-blue' }
              return (
                <tr key={d.id}>
                  <td className="mono" style={{ textAlign: 'center' }}>{d.employee_no ?? ''}</td>
                  <td className="name" style={{ textAlign: 'center' }}>{d.name}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{d.phone ?? ''}</td>
                  <td style={{ textAlign: 'center' }}>{d.license_type ?? ''}</td>
                  <td className="mono" style={{ textAlign: 'center' }}>{d.license_renewal_date ?? ''}</td>
                  <td style={{ textAlign: 'center' }}>
                    {d.line_user_id
                      ? <span className="badge badge-green">已綁定</span>
                      : <span className="badge badge-amber">未綁定</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <DriverRowActions vehicles={vehicles} driver={{
                      id: d.id,
                      employee_no: d.employee_no ?? null,
                      name: d.name,
                      birth_date: d.birth_date ?? null,
                      id_number: d.id_number ?? null,
                      phone: d.phone ?? null,
                      household_address: d.household_address ?? null,
                      mail_address: d.mail_address ?? null,
                      email: d.email ?? null,
                      license_type: d.license_type ?? null,
                      license_renewal_date: d.license_renewal_date ?? null,
                      hire_date: d.hire_date ?? null,
                      leave_date: d.leave_date ?? null,
                      labor_insurance: d.labor_insurance ?? null,
                      health_insurance: d.health_insurance ?? null,
                      line_user_id: d.line_user_id ?? null,
                      bank_name: d.bank_name ?? null,
                      bank_account: d.bank_account ?? null,
                      default_vehicle_id: d.default_vehicle_id ?? null,
                      status: d.status,
                      display_order: d.display_order ?? null,
                      show_in_dashboard: d.show_in_dashboard ?? true,
                      show_in_schedule:  d.show_in_schedule  ?? true,
                    }} />
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
