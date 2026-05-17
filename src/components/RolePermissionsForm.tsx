'use client'
import { useState, useTransition } from 'react'
import { ShieldCheck, Loader2, Check, LayoutDashboard, Plus, Pencil, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  NAV_HREFS, NAV_LABELS,
  DASHBOARD_SECTIONS, DASHBOARD_SECTION_LABELS,
  type NavHref, type DashboardSection,
  type RoleDefaults, type RoleDashboardSections,
} from '@/lib/permissions'
import {
  saveRoleDefaults, saveRoleDashboardSections,
  createRole, updateRole, deleteRole, countUsersInRole,
} from '@/app/(dashboard)/users/actions'
import type { Role } from '@/app/(dashboard)/users/actions'
import type { RoleRow } from '@/lib/roles.server'

interface Props {
  roles:    RoleRow[]
  defaults: RoleDefaults
  sections: RoleDashboardSections
}

const BADGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'badge-blue',   label: '藍色' },
  { value: 'badge-green',  label: '綠色' },
  { value: 'badge-amber',  label: '琥珀' },
  { value: 'badge-red',    label: '紅色' },
  { value: 'badge-purple', label: '紫色' },
]

export default function RolePermissionsForm({ roles, defaults, sections }: Props) {
  const router = useRouter()
  const [pageState, setPageState] = useState<Record<Role, Set<NavHref>>>(() => {
    const m: Record<string, Set<NavHref>> = {}
    for (const r of roles) m[r.key] = new Set<NavHref>((defaults[r.key] ?? []) as readonly NavHref[])
    return m
  })
  const [secState, setSecState] = useState<Record<Role, Set<DashboardSection>>>(() => {
    const m: Record<string, Set<DashboardSection>> = {}
    for (const r of roles) m[r.key] = new Set<DashboardSection>((sections[r.key] ?? []) as readonly DashboardSection[])
    return m
  })
  const [savedFlash,  setSavedFlash]  = useState<Role | null>(null)
  const [savingRole,  setSavingRole]  = useState<Role | null>(null)
  const [createOpen,  setCreateOpen]  = useState(false)
  const [renameRole,  setRenameRole]  = useState<RoleRow | null>(null)
  const [pending, startTransition] = useTransition()

  function togglePage(role: Role, href: NavHref) {
    setPageState(prev => {
      const next = new Set(prev[role] ?? [])
      if (next.has(href)) next.delete(href); else next.add(href)
      return { ...prev, [role]: next }
    })
  }
  function toggleSection(role: Role, key: DashboardSection) {
    setSecState(prev => {
      const next = new Set(prev[role] ?? [])
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
    const origPages = new Set<string>(defaults[role] ?? [])
    const origSec   = new Set<string>(sections[role] ?? [])
    return !setEq(origPages, (pageState[role] ?? new Set()) as ReadonlySet<string>)
        || !setEq(origSec,   (secState[role]  ?? new Set()) as ReadonlySet<string>)
  }

  function handleSave(role: Role) {
    setSavingRole(role)
    startTransition(async () => {
      const [r1, r2] = await Promise.all([
        saveRoleDefaults(role, Array.from(pageState[role] ?? [])),
        saveRoleDashboardSections(role, Array.from(secState[role] ?? [])),
      ])
      setSavingRole(null)
      const err = r1.error ?? r2.error
      if (err) { alert(`儲存失敗：${err}`); return }
      setSavedFlash(role)
      setTimeout(() => setSavedFlash(null), 1800)
      router.refresh()
    })
  }

  async function handleDelete(role: RoleRow) {
    if (role.is_builtin) return
    const { count, error } = await countUsersInRole(role.key)
    if (error) { alert(`查詢失敗：${error}`); return }
    const msg = count > 0
      ? `確定刪除「${role.label}」嗎？\n\n目前有 ${count} 個帳號使用此角色，將自動轉為「司機」。`
      : `確定刪除「${role.label}」嗎？`
    if (!confirm(msg)) return
    const res = await deleteRole(role.key)
    if (res.error) { alert(`刪除失敗：${res.error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <ShieldCheck size={16} style={{ color: 'var(--accent2)' }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>角色權限預設</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              設定每個身分組別預設可見的「頁面」與「儀表板區塊」。儲存後立即套用於所有同角色帳號。
              每個角色都會保留「儀表板」作為最低必要頁面。內建「管理員」「司機」不可刪除。
            </div>
          </div>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setCreateOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
          >
            <Plus size={14} /> 新增角色
          </button>
        </div>
      </div>

      {roles.map(meta => {
        const dirty = isDirty(meta.key)
        const busy = savingRole === meta.key && pending
        return (
          <div key={meta.key} className="card">
            <div className="card-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`badge ${meta.badge_class}`}>{meta.label}</span>
                <div>
                  <div className="card-title">{meta.label} 預設權限</div>
                  <div className="card-sub" style={{ fontFamily: 'inherit' }}>
                    {meta.is_builtin
                      ? '內建角色，不可刪除或變更 key。'
                      : `自訂角色 (key: ${meta.key})。`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {savedFlash === meta.key && (
                  <span style={{ fontSize: 12, color: 'var(--accent2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Check size={12} /> 已儲存
                  </span>
                )}
                <button
                  className="icon-btn"
                  title="重新命名"
                  onClick={() => setRenameRole(meta)}
                ><Pencil size={14} /></button>
                <button
                  className="icon-btn"
                  title={meta.is_builtin ? '內建角色不可刪除' : '刪除角色'}
                  disabled={meta.is_builtin}
                  onClick={() => handleDelete(meta)}
                  style={{ color: meta.is_builtin ? undefined : 'var(--red)' }}
                ><Trash2 size={14} /></button>
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
                  const checked = (pageState[meta.key] ?? new Set()).has(h)
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
                  const checked = (secState[meta.key] ?? new Set()).has(s)
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

      {createOpen && (
        <RoleFormModal
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); router.refresh() }}
        />
      )}
      {renameRole && (
        <RoleFormModal
          mode="edit"
          initial={renameRole}
          onClose={() => setRenameRole(null)}
          onSaved={() => { setRenameRole(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function RoleFormModal({
  mode, initial, onClose, onSaved,
}: {
  mode: 'create' | 'edit'
  initial?: RoleRow
  onClose: () => void
  onSaved: () => void
}) {
  const [key,    setKey]   = useState(initial?.key ?? '')
  const [label,  setLabel] = useState(initial?.label ?? '')
  const [badge,  setBadge] = useState(initial?.badge_class ?? 'badge-blue')
  const [saving, setSaving] = useState(false)
  const isEdit = mode === 'edit'

  async function submit() {
    setSaving(true)
    const res = isEdit
      ? await updateRole(initial!.key, { label, badge_class: badge })
      : await createRole({ key, label, badge_class: badge })
    setSaving(false)
    if (res.error) { alert(`儲存失敗：${res.error}`); return }
    onSaved()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 14, width: '100%', maxWidth: 420,
        padding: '24px 24px 20px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          {isEdit ? `編輯角色：${initial?.label}` : '新增角色'}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            角色 key（小寫英數與底線，建立後不可改）
          </span>
          <input
            type="text" className="input" value={key}
            disabled={isEdit}
            onChange={e => setKey(e.target.value.toLowerCase())}
            placeholder="例：accountant"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>顯示名稱</span>
          <input
            type="text" className="input" value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="例：會計"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>徽章顏色</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="input" value={badge} onChange={e => setBadge(e.target.value)} style={{ flex: 1 }}>
              {BADGE_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
            <span className={`badge ${badge}`}>{label || '預覽'}</span>
          </div>
        </label>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn" onClick={onClose}>取消</button>
          <button
            className="btn btn-primary"
            disabled={saving || !label.trim() || (!isEdit && !key.trim())}
            onClick={submit}
          >
            {saving ? '儲存中…' : isEdit ? '儲存變更' : '確認新增'}
          </button>
        </div>
      </div>
    </div>
  )
}
