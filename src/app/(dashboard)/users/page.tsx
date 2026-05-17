import { createServiceClient } from '@/lib/supabase/service'
import UserFormModal from '@/components/UserFormModal'
import UserRowActions from '@/components/UserRowActions'
import SortableTh from '@/components/SortableTh'
import { getCurrentProfile } from '@/lib/auth'

const ROLE_LABEL: Record<string, { label: string; cls: string }> = {
  admin:  { label: '管理員', cls: 'badge-blue'  },
  driver: { label: '司機',   cls: 'badge-green' },
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>
}) {
  const me = await getCurrentProfile()
  const supabase = createServiceClient()
  const { sort, dir } = await searchParams
  const sortField = sort ?? 'email'
  const ascending = (dir ?? 'asc') === 'asc'

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, username, role, driver_id, display_name, is_active, created_at')

  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, name, employee_no')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('name')

  const { data: usersList } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const emailById = new Map<string, string>()
  usersList.users.forEach(u => { if (u.email) emailById.set(u.id, u.email) })
  const driverNameById = new Map<string, string>()
  drivers?.forEach(d => driverNameById.set(d.id, d.name))

  type Row = {
    id: string
    email: string
    username: string | null
    role: 'admin' | 'driver'
    driver_id: string | null
    driver_name: string
    display_name: string | null
    is_active: boolean
  }

  const rows: Row[] = (profiles ?? []).map(p => ({
    id: p.id,
    email: emailById.get(p.id) ?? '',
    username: p.username ?? null,
    role: p.role,
    driver_id: p.driver_id,
    driver_name: p.driver_id ? (driverNameById.get(p.driver_id) ?? '') : '',
    display_name: p.display_name,
    is_active: p.is_active,
  }))

  const getKey = (r: Row): string | number => {
    switch (sortField) {
      case 'email':        return r.email
      case 'username':     return r.username ?? ''
      case 'display_name': return r.display_name ?? ''
      case 'role':         return r.role
      case 'driver':       return r.driver_name
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <UserFormModal mode="create" drivers={driverOptions} />
      </div>
      <div className="card">
        <div className="card-head">
          <div className="card-title">使用者管理</div>
        </div>
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr>
              <SortableTh field="email"        defaultField="email" defaultDir="asc">E-Mail</SortableTh>
              <SortableTh field="username"     defaultField="email" defaultDir="asc">用戶名</SortableTh>
              <SortableTh field="display_name" defaultField="email" defaultDir="asc">顯示名稱</SortableTh>
              <SortableTh field="role"         defaultField="email" defaultDir="asc">角色</SortableTh>
              <SortableTh field="driver"       defaultField="email" defaultDir="asc">對應司機</SortableTh>
              <SortableTh field="is_active"    defaultField="email" defaultDir="asc">狀態</SortableTh>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {!sortedRows.length ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>尚無資料</td></tr>
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
    </div>
  )
}
