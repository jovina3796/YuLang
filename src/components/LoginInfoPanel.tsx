import { createClient } from '@/lib/supabase/server'
import { User } from 'lucide-react'
import { getCurrentProfile } from '@/lib/auth'

function fmt(dt?: string | null) {
  if (!dt) return ''
  const d = new Date(dt)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ` +
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default async function LoginInfoPanel() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  const profile = await getCurrentProfile()

  const displayName = profile?.display_name?.trim()
    || user?.email?.split('@')[0]
    || '使用者'
  const email = profile?.email ?? user?.email ?? ''
  const role = profile?.role === 'admin' ? '管理員' : profile?.role === 'driver' ? '司機' : ''
  const avatarUrl = profile?.avatar_url ?? null

  const lastSignIn = user?.last_sign_in_at ?? null
  const passwordChanged =
    (user as any)?.user_metadata?.password_changed_at ??
    (user as any)?.identities?.[0]?.last_sign_in_at ??
    null

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-head" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="card-title">登入資訊</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px 10px' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--bg3)', overflow: 'hidden', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text3)',
        }}>
          {avatarUrl
            ? <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <User size={28} />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {displayName}
          </div>
          {email && (
            <div className="mono" style={{
              fontSize: 11, color: 'var(--text3)', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{email}</div>
          )}
          {role && (
            <div style={{ marginTop: 6 }}>
              <span className={`badge ${profile?.role === 'admin' ? 'badge-blue' : 'badge-green'}`}>{role}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '4px 16px 16px' }}>
        <Row label="前次登入" value={fmt(lastSignIn)} mono />
        <Row label="上次密碼變更" value={fmt(passwordChanged)} mono />
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
      fontSize: 12,
    }}>
      <span style={{ color: 'var(--text3)' }}>{label}</span>
      <span style={{
        color: 'var(--text)',
        fontFamily: mono ? 'var(--mono)' : 'inherit',
      }}>{value}</span>
    </div>
  )
}
