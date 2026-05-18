'use client'
import { useState } from 'react'
import { PencilLine, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createSubrouteAlias, updateSubrouteAlias, type SubrouteAliasInput } from '@/app/(dashboard)/vendor-info/subroutes/actions'

export type SubrouteAliasRow = {
  alias:        string
  billing_area: string
}

interface Props {
  mode:          'create' | 'edit'
  initial?:      SubrouteAliasRow
  billingAreas:  string[]
  trigger?:      React.ReactNode
}

export default function SubrouteAliasFormModal({ mode, initial, billingAreas, trigger }: Props) {
  const router = useRouter()
  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [alias,  setAlias]  = useState(initial?.alias        ?? '')
  const [area,   setArea]   = useState(initial?.billing_area ?? (billingAreas[0] ?? ''))
  const [areaCustom, setAreaCustom] = useState(false)

  function resetForm() {
    if (mode === 'create') {
      setAlias('')
      setArea(billingAreas[0] ?? '')
      setAreaCustom(false)
    }
  }

  async function handleSubmit() {
    const a = alias.trim()
    const b = area.trim()
    if (!a || !b) return
    const payload: SubrouteAliasInput = { alias: a, billing_area: b }
    setSaving(true)
    const { error } = mode === 'create'
      ? await createSubrouteAlias(payload)
      : await updateSubrouteAlias(initial!.alias, payload)
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); resetForm(); router.refresh()
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }

  const defaultTrigger = mode === 'create'
    ? <button className="btn btn-primary" onClick={() => setOpen(true)} title="新增對應" style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px' }}><Plus size={16} /></button>
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
            borderRadius: 14, width: '100%', maxWidth: 460,
            padding: '28px 28px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {mode === 'create' ? '新增配送區域對應' : '編輯配送區域對應'}
            </div>

            <label style={L}>
              <span style={LT}>配送區域（司機在 LINE 會打的字，唯一）</span>
              <input type="text" className="input" value={alias}
                     onChange={e => setAlias(e.target.value)} placeholder="例：永和、林口、桃園" />
            </label>

            <label style={L}>
              <span style={LT}>計價區域（對應 vendor_rate_rules.destination_area）</span>
              {areaCustom || billingAreas.length === 0 ? (
                <input type="text" className="input" value={area}
                       onChange={e => setArea(e.target.value)} placeholder="例：雙北、桃園-北" />
              ) : (
                <select className="input" value={area} onChange={e => setArea(e.target.value)}>
                  {billingAreas.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              )}
              <button
                type="button"
                onClick={() => setAreaCustom(c => !c)}
                style={{
                  fontSize: 11, color: 'var(--accent2)', background: 'none',
                  border: 'none', cursor: 'pointer', alignSelf: 'flex-start', padding: 0,
                }}
              >
                {areaCustom ? '← 改回下拉選擇' : '＋ 自訂新計價區域'}
              </button>
            </label>

            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              用途：司機輸入「冷鏈永和10」時，「永和」會被翻譯為計價區域「雙北」，再去匹配對應的運費規則。
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={() => { setOpen(false); resetForm() }}>取消</button>
              <button
                className="btn btn-primary"
                disabled={!alias.trim() || !area.trim() || saving}
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
