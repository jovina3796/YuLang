import { createServiceClient } from '@/lib/supabase/service'
import DriverFormModal from '@/components/DriverFormModal'
import DriverRowActions from '@/components/DriverRowActions'
import UserFormModal from '@/components/UserFormModal'
import UserRowActions from '@/components/UserRowActions'
import PendingDriverAccountList from '@/components/PendingDriverAccountList'
import SortableTh from '@/components/SortableTh'
import PeopleTabs from '@/components/PeopleTabs'
import { getCurrentProfile } from '@/lib/auth'

const DRIVER_STATUS: Record<string, { label: string; cls: string }> = {
  active:   { label: '在職', cls: 'badge-green' },
  inactive: { label: '離職', cls: 'badge-red'   },
  leave:    { label: '請假', cls: 'badge-amber'  },
}

const ROLE_LABEL: Record<string, { label: string; cls: string }> = {
  admin:  { label: '管理員', cls: 'badge-blue'  },
  driver: { label: '司機',   cls: 'badge-green' },
}

type TabKey = 'drivers' | 'users'

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sort?: string; dir?: string }>
}) {
  const sp = await searchParams
  const tab: TabKey = sp.tab === 'users' ? 'users' : 'drivers'
  const sortField = sp.sort ?? (tab === 'drivers' ? 'name' : 'email')
  const ascending = (sp.dir ?? 'asc') === 'asc'

  return (
    <div>
      <PeopleTabs activeTab={tab} />
      {tab === 'drivers'
        ? <DriversTab sortField={sortField} ascending={ascending} />
        : <UsersTab   sortField={sortField} ascending={ascending} />}
    </div>
  )
}

async function DriversTab({ sortField, ascending }: { sortField: string; ascending: boolean }) {
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

async function UsersTab({ sortField, ascending }: { sortField: string; ascending: boolean }) {
  const me = await getCurrentProfile()
  const supabase = createServiceClient()

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, username, role, driver_id, display_name, is_active, created_at, line_user_id, allowed_pages')

  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, name, employee_no, phone, line_user_id')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('name')

  const { data: usersList } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const emailById = new Map<string, string>()
  usersList.users.forEach(u => { if (u.email) emailById.set(u.id, u.email) })
  const driverById = new Map<string, { name: string; line_user_id: string | null }>()
  drivers?.forEach(d => driverById.set(d.id, { name: d.name, line_user_id: d.line_user_id ?? null }))

  // Pending：在 user_profiles 找不到對應 driver_id 的司機
  const claimedDriverIds = new Set(
    (profiles ?? []).map(p => p.driver_id).filter((x): x is string => !!x),
  )
  const pendingDrivers = (drivers ?? [])
    .filter(d => !claimedDriverIds.has(d.id))
    .map(d => ({ id: d.id, name: d.name, employee_no: d.employee_no ?? null, phone: d.phone ?? null }))

  type Row = {
    id: string
    email: string
    username: string | null
    role: 'admin' | 'driver'
    driver_id: string | null
    driver_name: string
    display_name: string | null
    is_active: boolean
    line_user_id: string | null
    allowed_pages: string[] | null
  }

  const rows: Row[] = (profiles ?? []).map(p => {
    const drv = p.driver_id ? driverById.get(p.driver_id) : undefined
    return {
      id: p.id,
      email: emailById.get(p.id) ?? '',
      username: p.username ?? null,
      role: p.role,
      driver_id: p.driver_id,
      driver_name: drv?.name ?? '',
      display_name: p.display_name,
      is_active: p.is_active,
      // 以 user_profiles 為準，若沒有但司機表有，仍顯示為已綁
      line_user_id: p.line_user_id ?? drv?.line_user_id ?? null,
      allowed_pages: (p.allowed_pages ?? null) as string[] | null,
    }
  })

  const getKey = (r: Row): string | number => {
    switch (sortField) {
      case 'email':        return r.email
      case 'username':     return r.username ?? ''
      case 'display_name': return r.display_name ?? ''
      case 'role':         return r.role
      case 'driver':       return r.driver_name
      case 'line':         return r.line_user_id ? 1 : 0
      case 'is_active':    return r.is_active ? 1 : 0
      default:             return ''
    }
  }
  const sortedRows = [...rows].sort((a, b) => {
    const av = getKey(a), bv = getKey(b)
    if (av === bv) return 0
    if (typeof av === 'number' && typeof bv === 'number') return ascending ? av - bv : bv - av
    const cmp = String(av).localeCompare(String(bv), 'zh-Hant')
    return ascending ? cmp : -cmp
  })

  const driverOptions = (drivers ?? []).map(d => ({ id: d.id, name: d.name, employee_no: d.employee_no ?? null }))

  return (
    <>
      <PendingDriverAccountList drivers={pendingDrivers} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <UserFormModal mode="create" drivers={driverOptions} />
      </div>
      <div className="card">
        <div className="card-head">
          <div className="card-title">登入帳號</div>
        </div>
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead>
            <tr>
              <SortableTh field="email"        defaultField="email" defaultDir="asc">E-Mail</SortableTh>
              <SortableTh field="username"     defaultField="email" defaultDir="asc">用戶名</SortableTh>
              <SortableTh field="display_name" defaultField="email" defaultDir="asc">顯示名稱</SortableTh>
              <SortableTh field="role"         defaultField="email" defaultDir="asc">角色</SortableTh>
              <SortableTh field="driver"       defaultField="email" defaultDir="asc">對應司機</SortableTh>
              <SortableTh field="line"         defaultField="email" defaultDir="asc">LINE 綁定</SortableTh>
              <SortableTh field="is_active"    defaultField="email" defaultDir="asc">狀態</SortableTh>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {!sortedRows.length ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>尚無資料</td></tr>
            ) : sortedRows.map(r => {
              const role = ROLE_LABEL[r.role] ?? { label: r.role, cls: 'badge-blue' }
              return (
                <tr key={r.id}>
                  <td className="mono" style={{ textAlign: 'center' }}>{r.email}</td>
                  <td className="mono" style={{ textAlign: 'center' }}>{r.username ?? ''}</td>
                  <td style={{ textAlign: 'center' }}>{r.display_name ?? ''}</td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${role.cls}`}>{role.label}</span></td>
                  <td style={{ textAlign: 'center' }}>{r.driver_name}</td>
                  <td style={{ textAlign: 'center' }}>
                    {r.line_user_id
                      ? <span className="badge badge-green">已綁定</span>
                      : <span className="badge badge-amber">未綁定</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {r.is_active
                      ? <span className="badge badge-green">啟用</span>
                      : <span className="badge badge-red">停用</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <UserRowActions
                      user={{
                        id: r.id,
                        email: r.email,
                        username: r.username,
                        role: r.role,
                        driver_id: r.driver_id,
                        display_name: r.display_name,
                        is_active: r.is_active,
                        line_user_id: r.line_user_id,
                        allowed_pages: r.allowed_pages,
                      }}
                      drivers={driverOptions}
                      isSelf={me?.id === r.id}
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
