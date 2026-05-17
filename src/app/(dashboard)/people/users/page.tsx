import { createServiceClient } from '@/lib/supabase/service'
import UserFormModal from '@/components/UserFormModal'
import UserRowActions from '@/components/UserRowActions'
import PendingDriverAccountList from '@/components/PendingDriverAccountList'
import SortableTh from '@/components/SortableTh'
import { getCurrentProfile } from '@/lib/auth'
import { loadRoleDefaults } from '@/lib/rolePermissions.server'
import { loadRoles, loadRoleMap } from '@/lib/roles.server'

export default async function UsersTabPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>
}) {
  const sp = await searchParams
  const sortField = sp.sort ?? 'email'
  const ascending = (sp.dir ?? 'asc') === 'asc'

  const me = await getCurrentProfile()
  const supabase = createServiceClient()
  const [roleDefaults, roleMap, roles] = await Promise.all([
    loadRoleDefaults(),
    loadRoleMap(),
    loadRoles(),
  ])

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, username, role, driver_id, display_name, real_name, phone, is_active, created_at, line_user_id, allowed_pages')

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
    role: string
    driver_id: string | null
    driver_name: string
    display_name: string | null
    real_name: string | null
    phone: string | null
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
      real_name: p.real_name ?? null,
      phone: p.phone ?? null,
      is_active: p.is_active,
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
        <UserFormModal mode="create" drivers={driverOptions} roleDefaults={roleDefaults} roles={roles} />
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
              const role = roleMap[r.role] ?? { label: r.role, badge_class: 'badge-blue' }
              return (
                <tr key={r.id}>
                  <td className="mono" style={{ textAlign: 'center' }}>{r.email}</td>
                  <td className="mono" style={{ textAlign: 'center' }}>{r.username ?? ''}</td>
                  <td style={{ textAlign: 'center' }}>{r.display_name ?? ''}</td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${role.badge_class}`}>{role.label}</span></td>
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
                        real_name: r.real_name,
                        phone: r.phone,
                        is_active: r.is_active,
                        line_user_id: r.line_user_id,
                        allowed_pages: r.allowed_pages,
                      }}
                      drivers={driverOptions}
                      roleDefaults={roleDefaults}
                      roles={roles}
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
