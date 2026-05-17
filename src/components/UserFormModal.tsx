'use client'
import { useState } from 'react'
import { PencilLine, Plus, Link2, Link2Off } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createUser, updateUser, type UserInput, type Role } from '@/app/(dashboard)/users/actions'
import { NAV_HREFS, NAV_LABELS, ROLE_DEFAULTS_FALLBACK, type NavHref, type RoleDefaults } from '@/lib/permissions'

export type UserRow = {
  id:            string
  email:         string
  username:      string | null
  role:          Role
  driver_id:     string | null
  display_name:  string | null
  real_name:     string | null
  phone:         string | null
  is_active:     boolean
  line_user_id:  string | null
  allowed_pages: string[] | null
}

export type DriverOption = { id: string; name: string; employee_no: string | null }

interface Props {
  mode:     'create' | 'edit'
  initial?: UserRow
  drivers?: DriverOption[]   // retained for back-compat with callers; not used
  roleDefaults?: RoleDefaults
  trigger?: React.ReactNode
}

export default function UserFormModal({ mode, initial, roleDefaults, trigger }: Props) {
  const router = useRouter()
  const defaults: RoleDefaults = roleDefaults ?? ROLE_DEFAULTS_FALLBACK

  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)

  const [username,    setUsername]    = useState(initial?.username ?? '')
  const [displayName, setDisplayName] = useState(initial?.display_name ?? '')
  const [realName,    setRealName]    = useState(initial?.real_name ?? '')
  const [phone,       setPhone]       = useState(initial?.phone ?? '')
  const [email,       setEmail]       = useState(initial?.email ?? '')
  const [password,    setPassword]    = useState('')
  const [lineId,      setLineId]      = useState(initial?.line_user_id ?? '')
  const [role,        setRole]        = useState<Role>(initial?.role ?? 'admin')
  const [isActive,    setIsActive]    = useState<boolean>(initial?.is_active ?? true)

  // null = 沿用角色預設（全勾），陣列 = 顯式子集
  const initialAllowed: Set<NavHref> = (() => {
    const role0 = initial?.role ?? 'admin'
    const baseSet = new Set<NavHref>(defaults[role0] as readonly NavHref[])
    if (!initial?.allowed_pages) return baseSet
    return new Set<NavHref>(initial.allowed_pages.filter(h => baseSet.has(h as NavHref)) as NavHref[])
  })()
  const [allowed, setAllowed] = useState<Set<NavHref>>(initialAllowed)

  function resetForm() {
    if (mode === 'create') {
      setUsername(''); setDisplayName(''); setRealName(''); setPhone('')
      setEmail(''); setPassword(''); setLineId('')
      setRole('admin'); setIsActive(true)
      setAllowed(new Set<NavHref>(defaults.admin as readonly NavHref[]))
    }
  }

  function changeRole(next: Role) {
    setRole(next)
    setAllowed(new Set<NavHref>(defaults[next] as readonly NavHref[]))
  }

  function togglePage(href: NavHref) {
    setAllowed(prev => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href); else next.add(href)
      return next
    })
  }

  async function handleSubmit() {
    if (!email.trim()) { alert('請輸入 E-Mail'); return }
    if (mode === 'create' && (!password || password.length < 6)) { alert('密碼至少 6 碼'); return }
    const normalizedUsername = username.trim().toLowerCase()
    if (normalizedUsername && !/^[a-z0-9._]{3,30}$/.test(normalizedUsername)) {
      alert('用戶名僅允許 3-30 個小寫英數、底線、點'); return
    }

    const currentDefaults = new Set<NavHref>(defaults[role] as readonly NavHref[])
    const allFull = allowed.size === currentDefaults.size &&
      Array.from(currentDefaults).every(h => allowed.has(h))
    const allowedPagesPayload = allFull ? null : Array.from(allowed)

    const base: Omit<UserInput, 'password'> = {
      email:         email.trim(),
      username:      normalizedUsername || null,
      role,
      display_name:  displayName.trim() || null,
      real_name:     realName.trim()    || null,
      phone:         phone.trim()       || null,
      line_user_id:  lineId.trim()      || null,
      is_active:     isActive,
      allowed_pages: allowedPagesPayload,
    }
    setSaving(true)
    const { error } = mode === 'create'
      ? await createUser({ ...base, password } as UserInput)
      : await updateUser(initial!.id, base)
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); resetForm(); router.refresh()
  }

  const L:  React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }
  const G2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

  const lineBound = !!lineId.trim()

  const defaultTrigger = mode === 'create'
    ? <button className="btn btn-primary" onClick={() => setOpen(true)} title="新增使用者" style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px' }}><Plus size={16} /></button>
    : <button className="icon-btn" onClick={() => setOpen(true)} title="編輯"><PencilLine size={14} /></button>

  return (
    <>
      {trigger
        ? <span onClick={() => setOpen(true)} style={{ display: 'inline-flex' }}>{trigger}</span>
        : defaultTrigger}

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={e => e.target === e.currentTarget && (setOpen(false), resetForm())}
        >
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 14, width: '100%', maxWidth: 560,
            padding: '28px 28px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {mode === 'create' ? '新增登入帳號' : '編輯登入帳號'}
            </div>

            {/* Row 1: 用戶名稱 | 暱稱 */}
            <div style={G2}>
              <label style={L}>
                <span style={LT}>用戶名稱（3-30 個小寫英數 / _ / .）</span>
                <input type="text" className="input" value={username}
                       onChange={e => setUsername(e.target.value.toLowerCase())}
                       placeholder="例：john.doe" autoComplete="off" />
              </label>
              <label style={L}>
                <span style={LT}>暱稱</span>
                <input type="text" className="input" value={displayName}
                       onChange={e => setDisplayName(e.target.value)} placeholder="顯示於介面" />
              </label>
            </div>

            {/* Row 2: 真實姓名 | 手機號碼 */}
            <div style={G2}>
              <label style={L}>
                <span style={LT}>真實姓名</span>
                <input type="text" className="input" value={realName}
                       onChange={e => setRealName(e.target.value)} placeholder="本名" />
              </label>
              <label style={L}>
                <span style={LT}>手機號碼</span>
                <input type="tel" className="input" value={phone}
                       onChange={e => setPhone(e.target.value)} placeholder="例：0912345678" />
              </label>
            </div>

            {/* Row 3: Email */}
            <label style={L}>
              <span style={LT}>E-Mail</span>
              <input type="email" className="input" value={email}
                     onChange={e => setEmail(e.target.value)} placeholder="必填" />
            </label>

            {mode === 'create' && (
              <label style={L}>
                <span style={LT}>密碼（至少 6 碼）</span>
                <input type="password" className="input" value={password}
                       onChange={e => setPassword(e.target.value)} placeholder="必填" />
              </label>
            )}

            {/* Row 4: LINE ID + 綁定狀態 */}
            <label style={L}>
              <span style={LT}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span>LINE ID（用於關聯登入帳號與司機資訊）</span>
                  {lineBound
                    ? <span className="badge badge-green"><Link2 size={10} />已綁定</span>
                    : <span className="badge badge-amber"><Link2Off size={10} />未綁定</span>}
                </span>
              </span>
              <input type="text" className="input" value={lineId}
                     onChange={e => setLineId(e.target.value)}
                     placeholder="LINE userId（綁定後系統會自動帶入對應司機）" />
            </label>

            {/* Row 5: 身分組別 | 帳號狀態 */}
            <div style={G2}>
              <label style={L}>
                <span style={LT}>身分組別</span>
                <select className="input" value={role} onChange={e => changeRole(e.target.value as Role)}>
                  <option value="admin">管理員</option>
                  <option value="driver">司機</option>
                </select>
              </label>
              <label style={L}>
                <span style={LT}>帳號狀態</span>
                <select className="input" value={isActive ? '1' : '0'} onChange={e => setIsActive(e.target.value === '1')}>
                  <option value="1">啟用</option>
                  <option value="0">停用</option>
                </select>
              </label>
            </div>

            {/* Row 6: 可見頁面設定 — 僅 admin 角色顯示 */}
            {role === 'admin' && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 4 }}>
                  可見頁面設定
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
                  全勾＝沿用角色預設、取消部分項目則為精細限制
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 10,
                }}>
                  {NAV_HREFS.filter(h => (defaults[role] as readonly string[]).includes(h)).map(h => (
                    <label key={h} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 12, cursor: 'pointer',
                    }}>
                      <input type="checkbox" checked={allowed.has(h)} onChange={() => togglePage(h)} />
                      <span>{NAV_LABELS[h]}</span>
                      <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{h}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={() => { setOpen(false); resetForm() }}>取消</button>
              <button
                className="btn btn-primary"
                disabled={!email.trim() || saving}
                onClick={handleSubmit}
              >
                {saving ? '儲存中…' : mode === 'create' ? '確認新增' : '儲存變更'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
