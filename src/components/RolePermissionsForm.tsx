'use client'
import { useState, useTransition } from 'react'
import { ShieldCheck, Loader2, Check, LayoutDashboard } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  NAV_HREFS, NAV_LABELS,
  DASHBOARD_SECTIONS, DASHBOARD_SECTION_LABELS,
  type NavHref, type DashboardSection,
  type RoleDefaults, type RoleDashboardSections,
} from '@/lib/permissions'
import { saveRoleDefaults, saveRoleDashboardSections } from '@/app/(dashboard)/users/actions'
import type { Role } from '@/app/(dashboard)/users/actions'

interface Props {
  defaults: RoleDefaults
  sections: RoleDashboardSections
}

const ROLE_META: { key: Role; label: string; cls: string; hint: string }[] = [
  { key: 'admin',  label: '管理員', cls: 'badge-blue',
    hint: '管理員角色預設可見的頁面與儀表板區塊。個別管理員的「可見頁面設定」會以此為上限。' },
  { key: 'driver', label: '司機',   cls: 'badge-green',
    hint: '司機角色預設可見的頁面與儀表板區塊。建議僅開放與其相關的功能。' },
]

export default function RolePermissionsForm({ defaults, sections }: Props) {
  const router = useRouter()
  const [pageState, setPageState] = useState<Record<Role, Set<NavHref>>>(() => ({
    admin:  new Set<NavHref>(defaults.admin  as readonly NavHref[]),
    driver: new Set<NavHref>(defaults.driver as readonly NavHref[]),
  }))
  const [secState, setSecState] = useState<Record<Role, Set<DashboardSection>>>(() => ({
    admin:  new Set<DashboardSection>(sections.admin  as readonly DashboardSection[]),
    driver: new Set<DashboardSection>(sections.driver as readonly DashboardSection[]),
  }))
  const [savedFlash, setSavedFlash] = useState<Role | null>(null)
  const [savingRole, setSavingRole] = useState<Role | null>(null)
  const [pending, startTransition] = useTransition()

  function togglePage(role: Role, href: NavHref) {
    setPageState(prev => {
      const next = new Set(prev[role])
      if (next.has(href)) next.delete(href); else next.add(href)
      return { ...prev, [role]: next }
    })
  }
  function toggleSection(role: Role, key: DashboardSection) {
    setSecState(prev => {
      const next = new Set(prev[role])
      if (next.has(key)) next.delete(key); else next.add(key)
      return { ...prev, [role]: next }
    })
  }
  function selectAllPages(role: Role) {
    setPageState(prev => ({ ...prev, [role]: new Set<NavHref>(NAV_HREFS) }))
  }
  function clearAllPages(role: Role) {
    setPageState(prev => ({ ...prev, [role]: new Set<NavHref>(['/dashboard']) }))
  }
  function selectAllSections(role: Role) {
    setSecState(prev => ({ ...prev, [role]: new Set<DashboardSection>(DASHBOARD_SECTIONS) }))
  }
  function clearAllSections(role: Role) {
    setSecState(prev => ({ ...prev, [role]: new Set<DashboardSection>() }))
  }

  function setEq<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
    if (a.size !== b.size) return false
    for (const x of a) if (!b.has(x)) return false
    return true
  }
  function isDirty(role: Role): boolean {
    const origPages = new Set<string>(defaults[role])
    const origSec   = new Set<string>(sections[role])
    return !setEq(origPages, pageState[role] as ReadonlySet<string>)
        || !setEq(origSec,   secState[role]  as ReadonlySet<string>)
  }

  function handleSave(role: Role) {
    setSavingRole(role)
    startTransition(async () => {
      const [r1, r2] = await Promise.all([
        saveRoleDefaults(role, Array.from(pageState[role])),
        saveRoleDashboardSections(role, Array.from(secState[role])),
      ])
      setSavingRole(null)
      const err = r1.error ?? r2.error
      if (err) { alert(`儲存失敗：${err}`); return }
      setSavedFlash(role)
      setTimeout(() => setSavedFlash(null), 1800)
      router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <ShieldCheck size={16} style={{ color: 'var(--accent2)' }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>角色權限預設</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          設定每個身分組別預設可見的「頁面」與「儀表板區塊」。儲存後立即套用於所有同角色帳號。
          每個角色都會保留「儀表板」作為最低必要頁面。
        </div>
      </div>

      {ROLE_META.map(meta => {
        const dirty = isDirty(meta.key)
        const busy = savingRole === meta.key && pending
        return (
          <div key={meta.key} className="card">
            <div className="card-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`badge ${meta.cls}`}>{meta.label}</span>
                <div>
                  <div className="card-title">{meta.label} 預設權限</div>
                  <div className="card-sub" style={{ fontFamily: 'inherit' }}>{meta.hint}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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

            {/* 頁面權限 */}
            <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                  <ShieldCheck size={14} style={{ color: 'var(--accent2)' }} /> 可見頁面（左側導覽）
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => selectAllPages(meta.key)} disabled={busy}>全選</button>
                  <button className="btn btn-sm" onClick={() => clearAllPages(meta.key)} disabled={busy}>僅儀表板</button>
                </div>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 8,
              }}>
                {NAV_HREFS.map(h => {
                  const lockDashboard = h === '/dashboard'
                  const checked = pageState[meta.key].has(h)
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
                        checked={checked}
                        disabled={lockDashboard || busy}
                        onChange={() => togglePage(meta.key, h)}
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

            {/* 儀表板區塊 */}
            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                  <LayoutDashboard size={14} style={{ color: 'var(--blue)' }} /> 儀表板可見區塊
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => selectAllSections(meta.key)} disabled={busy}>全選</button>
                  <button className="btn btn-sm" onClick={() => clearAllSections(meta.key)} disabled={busy}>全不選</button>
                </div>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 8,
              }}>
                {DASHBOARD_SECTIONS.map(s => {
                  const checked = secState[meta.key].has(s)
                  return (
                    <label key={s} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 8,
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      cursor: 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={() => toggleSection(meta.key, s)}
                      />
                      <span style={{ fontSize: 13 }}>{DASHBOARD_SECTION_LABELS[s]}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
