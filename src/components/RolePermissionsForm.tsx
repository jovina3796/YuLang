'use client'
import { useState, useTransition } from 'react'
import { ShieldCheck, Loader2, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { NAV_HREFS, NAV_LABELS, type NavHref, type RoleDefaults } from '@/lib/permissions'
import { saveRoleDefaults } from '@/app/(dashboard)/users/actions'
import type { Role } from '@/app/(dashboard)/users/actions'

interface Props {
  defaults: RoleDefaults
}

const ROLE_META: { key: Role; label: string; cls: string; hint: string }[] = [
  { key: 'admin',  label: '管理員', cls: 'badge-blue',
    hint: '管理員預設可見的頁面集合。個別管理員的「可見頁面設定」會以此為上限。' },
  { key: 'driver', label: '司機',   cls: 'badge-green',
    hint: '司機角色預設可見的頁面集合。建議僅開放與其相關的功能。' },
]

export default function RolePermissionsForm({ defaults }: Props) {
  const router = useRouter()
  const [state, setState] = useState<Record<Role, Set<NavHref>>>(() => ({
    admin:  new Set<NavHref>(defaults.admin  as readonly NavHref[]),
    driver: new Set<NavHref>(defaults.driver as readonly NavHref[]),
  }))
  const [savedFlash, setSavedFlash] = useState<Role | null>(null)
  const [savingRole, setSavingRole] = useState<Role | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle(role: Role, href: NavHref) {
    setState(prev => {
      const next = new Set(prev[role])
      if (next.has(href)) next.delete(href); else next.add(href)
      return { ...prev, [role]: next }
    })
  }

  function isDirty(role: Role): boolean {
    const orig = new Set<string>(defaults[role])
    const cur = state[role]
    if (orig.size !== cur.size) return true
    for (const h of cur) if (!orig.has(h)) return true
    return false
  }

  function handleSave(role: Role) {
    const pages = Array.from(state[role])
    setSavingRole(role)
    startTransition(async () => {
      const r = await saveRoleDefaults(role, pages)
      setSavingRole(null)
      if (r.error) { alert(`儲存失敗：${r.error}`); return }
      setSavedFlash(role)
      setTimeout(() => setSavedFlash(null), 1800)
      router.refresh()
    })
  }

  function selectAll(role: Role) {
    setState(prev => ({ ...prev, [role]: new Set<NavHref>(NAV_HREFS) }))
  }

  function clearAll(role: Role) {
    setState(prev => ({ ...prev, [role]: new Set<NavHref>(['/dashboard']) }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <ShieldCheck size={16} style={{ color: 'var(--accent2)' }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>角色預設可見頁面</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          設定每個身分組別預設可見的頁面範圍。儲存後立即套用於所有同角色帳號（未自訂可見頁面的）。
          每個角色都會保留「儀表板」作為最低必要頁面。
        </div>
      </div>

      {ROLE_META.map(meta => {
        const cur = state[meta.key]
        const dirty = isDirty(meta.key)
        const busy = savingRole === meta.key && pending
        return (
          <div key={meta.key} className="card">
            <div className="card-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`badge ${meta.cls}`}>{meta.label}</span>
                <div>
                  <div className="card-title">{meta.label} 預設可見頁面</div>
                  <div className="card-sub" style={{ fontFamily: 'inherit' }}>{meta.hint}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="btn btn-sm" onClick={() => selectAll(meta.key)} disabled={busy}>全選</button>
                <button className="btn btn-sm" onClick={() => clearAll(meta.key)} disabled={busy}>僅儀表板</button>
                {savedFlash === meta.key && (
                  <span style={{ fontSize: 12, color: 'var(--accent2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Check size={12} /> 已儲存
                  </span>
                )}
                <button
                  className="btn btn-sm btn-primary"
                  disabled={!dirty || busy}
                  onClick={() => handleSave(meta.key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {busy && <Loader2 size={12} className="animate-spin" />}
                  儲存
                </button>
              </div>
            </div>
            <div style={{
              padding: 14,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 8,
            }}>
              {NAV_HREFS.map(h => {
                const lockDashboard = h === '/dashboard'
                return (
                  <label key={h} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 8,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    cursor: lockDashboard ? 'not-allowed' : 'pointer',
                    opacity: lockDashboard ? 0.7 : 1,
                  }}>
                    <input
                      type="checkbox"
                      checked={cur.has(h)}
                      disabled={lockDashboard || busy}
                      onChange={() => toggle(meta.key, h)}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                      <span style={{ fontSize: 13 }}>{NAV_LABELS[h]}</span>
                      <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{h}</span>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
