'use client'
import { useEffect, useState, useTransition } from 'react'
import { Check, Palette, Type, Hash, RotateCcw, Sparkles, Loader2 } from 'lucide-react'
import { saveCustomTheme, type CustomTheme } from '@/app/(dashboard)/settings/actions'

type AccentKey = 'green' | 'blue' | 'purple' | 'amber' | 'red' | 'cyan' | 'custom'
type FontKey   = 'noto' | 'system' | 'lxgw' | 'serif'
type MonoKey   = 'dm' | 'jetbrain' | 'fira' | 'ibm' | 'roboto'

const ACCENTS: { key: Exclude<AccentKey,'custom'>; label: string; swatch: string }[] = [
  { key: 'green',  label: '森林綠',   swatch: '#3fb950' },
  { key: 'blue',   label: '海洋藍',   swatch: '#388bfd' },
  { key: 'purple', label: '丁香紫',   swatch: '#a371f7' },
  { key: 'amber',  label: '琥珀黃',   swatch: '#d29922' },
  { key: 'red',    label: '珊瑚紅',   swatch: '#f85149' },
  { key: 'cyan',   label: '青瓷藍',   swatch: '#22b8cf' },
]

const FONTS: { key: FontKey; label: string; sample: string; family: string }[] = [
  { key: 'noto',   label: '思源黑體', sample: '馭浪物流 ERP Yulang 0123', family: "'Noto Sans TC', sans-serif" },
  { key: 'system', label: '系統預設', sample: '馭浪物流 ERP Yulang 0123', family: "-apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif" },
  { key: 'lxgw',   label: '霞鶩文楷', sample: '馭浪物流 ERP Yulang 0123', family: "'LXGW WenKai TC', 'Noto Sans TC', sans-serif" },
  { key: 'serif',  label: '思源宋體', sample: '馭浪物流 ERP Yulang 0123', family: "'Noto Serif TC', 'Songti TC', serif" },
]

const MONOS: { key: MonoKey; label: string; family: string }[] = [
  { key: 'dm',       label: 'DM Mono',        family: "'DM Mono', monospace" },
  { key: 'jetbrain', label: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
  { key: 'fira',     label: 'Fira Code',      family: "'Fira Code', monospace" },
  { key: 'ibm',      label: 'IBM Plex Mono',  family: "'IBM Plex Mono', monospace" },
  { key: 'roboto',   label: 'Roboto Mono',    family: "'Roboto Mono', monospace" },
]

const DEFAULT_CUSTOM: CustomTheme = {
  bg:      '#0d1117',
  bg2:     '#161b22',
  text:    '#e6edf3',
  text2:   '#8b949e',
  border:  '#2a313c',
  accent:  '#2ea043',
  accent2: '#3fb950',
}

const TOKEN_LABELS: { key: keyof CustomTheme; label: string; hint: string }[] = [
  { key: 'bg',      label: '主背景',  hint: '頁面底色' },
  { key: 'bg2',     label: '次背景',  hint: '卡片／側欄底色' },
  { key: 'text',    label: '主文字',  hint: '標題、表格主要內容' },
  { key: 'text2',   label: '次文字',  hint: '說明文、副標' },
  { key: 'border',  label: '邊框',    hint: '卡片、表格分隔線' },
  { key: 'accent',  label: '主強調',  hint: '按鈕、選取色（深）' },
  { key: 'accent2', label: '副強調',  hint: '連結、KPI 數字（淺）' },
]

function applyCustomVars(t: CustomTheme) {
  const root = document.documentElement
  root.style.setProperty('--bg',      t.bg)
  root.style.setProperty('--bg2',     t.bg2)
  root.style.setProperty('--text',    t.text)
  root.style.setProperty('--text2',   t.text2)
  root.style.setProperty('--border',  t.border)
  root.style.setProperty('--accent',  t.accent)
  root.style.setProperty('--accent2', t.accent2)
}

function clearCustomVars() {
  const root = document.documentElement
  ;['--bg','--bg2','--text','--text2','--border','--accent','--accent2']
    .forEach(p => root.style.removeProperty(p))
}

export default function SettingsForm({ initialTheme }: { initialTheme: CustomTheme | null }) {
  const [accent, setAccent] = useState<AccentKey>('green')
  const [font,   setFont]   = useState<FontKey>('noto')
  const [mono,   setMono]   = useState<MonoKey>('dm')
  const [custom, setCustom] = useState<CustomTheme>(initialTheme ?? DEFAULT_CUSTOM)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const a = (localStorage.getItem('accent') as AccentKey | null)
    const eff: AccentKey = a ?? (initialTheme ? 'custom' : 'green')
    setAccent(eff)
    if (!a && initialTheme) {
      document.documentElement.setAttribute('data-accent', 'custom')
      localStorage.setItem('accent', 'custom')
    }
    setFont(  (localStorage.getItem('font')   as FontKey   | null) ?? 'noto')
    setMono(  (localStorage.getItem('mono')   as MonoKey   | null) ?? 'dm')
  }, [initialTheme])

  function applyAccent(key: AccentKey) {
    setAccent(key)
    document.documentElement.setAttribute('data-accent', key)
    localStorage.setItem('accent', key)
    if (key !== 'custom') clearCustomVars()
  }

  function applyFont(key: FontKey) {
    setFont(key)
    document.documentElement.setAttribute('data-font', key)
    localStorage.setItem('font', key)
  }

  function applyMono(key: MonoKey) {
    setMono(key)
    document.documentElement.setAttribute('data-mono', key)
    localStorage.setItem('mono', key)
  }

  function updateCustom(key: keyof CustomTheme, value: string) {
    const next = { ...custom, [key]: value }
    setCustom(next)
    if (accent === 'custom') applyCustomVars(next)
  }

  function saveCustom() {
    startTransition(async () => {
      const r = await saveCustomTheme(custom)
      if (r.ok) {
        applyAccent('custom')
        applyCustomVars(custom)
        setSavedMsg('已儲存自訂主題')
      } else {
        setSavedMsg(r.error ?? '儲存失敗')
      }
      setTimeout(() => setSavedMsg(null), 2400)
    })
  }

  function clearCustom() {
    startTransition(async () => {
      const r = await saveCustomTheme(null)
      if (r.ok) {
        setCustom(DEFAULT_CUSTOM)
        applyAccent('green')
        setSavedMsg('已清除自訂主題')
      } else {
        setSavedMsg(r.error ?? '清除失敗')
      }
      setTimeout(() => setSavedMsg(null), 2400)
    })
  }

  function resetAll() {
    applyAccent('green')
    applyFont('noto')
    applyMono('dm')
  }

  const sectionTitle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 14, fontWeight: 600, marginBottom: 14,
  }
  const subText: React.CSSProperties = { fontSize: 11, color: 'var(--text3)', marginTop: 10 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-sm" onClick={resetAll} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <RotateCcw size={13} /> 還原預設
        </button>
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={sectionTitle}>
          <Palette size={16} style={{ color: 'var(--accent2)' }} /> 主題色彩
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {ACCENTS.map(a => {
            const selected = accent === a.key
            return (
              <button
                key={a.key}
                onClick={() => applyAccent(a.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                  background: selected ? 'rgba(46,160,67,0.08)' : 'var(--bg)',
                  border: `1px solid ${selected ? 'var(--accent2)' : 'var(--border)'}`,
                  color: 'var(--text)', fontSize: 13,
                  transition: 'all .15s',
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: a.swatch,
                  border: '2px solid var(--bg2)',
                  boxShadow: '0 0 0 1px var(--border)',
                  flexShrink: 0,
                }} />
                <span style={{ flex: 1, textAlign: 'left' }}>{a.label}</span>
                {selected && <Check size={14} style={{ color: 'var(--accent2)' }} />}
              </button>
            )
          })}
          <button
            onClick={() => { applyAccent('custom'); applyCustomVars(custom) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
              background: accent === 'custom' ? 'rgba(46,160,67,0.08)' : 'var(--bg)',
              border: `1px solid ${accent === 'custom' ? 'var(--accent2)' : 'var(--border)'}`,
              color: 'var(--text)', fontSize: 13,
              transition: 'all .15s',
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: '50%',
              background: `conic-gradient(${custom.accent},${custom.accent2},${custom.bg2},${custom.accent})`,
              border: '2px solid var(--bg2)',
              boxShadow: '0 0 0 1px var(--border)',
              flexShrink: 0,
            }} />
            <span style={{ flex: 1, textAlign: 'left', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={12} /> 自訂
            </span>
            {accent === 'custom' && <Check size={14} style={{ color: 'var(--accent2)' }} />}
          </button>
        </div>
        <div style={subText}>影響按鈕、連結、KPI 數字等強調色彩。儲存後立即套用，並會記住您的選擇。</div>

        {accent === 'custom' && (
          <div style={{
            marginTop: 16, padding: 16, borderRadius: 10,
            background: 'var(--bg)', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={13} style={{ color: 'var(--accent2)' }} />
              自訂 7 個關鍵色彩 token
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {TOKEN_LABELS.map(t => (
                <label key={t.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8,
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  cursor: 'pointer',
                }}>
                  <input
                    type="color"
                    value={custom[t.key]}
                    onChange={e => updateCustom(t.key, e.target.value)}
                    style={{
                      width: 28, height: 28, padding: 0, border: 'none',
                      borderRadius: 6, background: 'transparent', cursor: 'pointer',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                      {custom[t.key]}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 14 }}>
              {savedMsg && (
                <span style={{ fontSize: 12, color: 'var(--accent2)' }}>{savedMsg}</span>
              )}
              <button className="btn btn-sm" onClick={clearCustom} disabled={pending}>
                清除自訂
              </button>
              <button className="btn btn-sm btn-primary" onClick={saveCustom} disabled={pending}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {pending && <Loader2 size={12} className="animate-spin" />}
                儲存自訂主題
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={sectionTitle}>
          <Type size={16} style={{ color: 'var(--blue)' }} /> 整體字型
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {FONTS.map(f => {
            const selected = font === f.key
            return (
              <button
                key={f.key}
                onClick={() => applyFont(f.key)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                  background: selected ? 'rgba(56,139,253,0.08)' : 'var(--bg)',
                  border: `1px solid ${selected ? 'var(--blue)' : 'var(--border)'}`,
                  color: 'var(--text)', textAlign: 'left',
                  transition: 'all .15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</span>
                  {selected && <Check size={14} style={{ color: 'var(--blue)' }} />}
                </div>
                <span style={{ fontFamily: f.family, fontSize: 14, color: 'var(--text2)' }}>{f.sample}</span>
              </button>
            )
          })}
        </div>
        <div style={subText}>切換頁面整體字型；數字欄位仍維持等寬字型以利對齊。</div>
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={sectionTitle}>
          <Hash size={16} style={{ color: 'var(--amber2)' }} /> 數字等寬字型
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {MONOS.map(m => {
            const selected = mono === m.key
            return (
              <button
                key={m.key}
                onClick={() => applyMono(m.key)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                  background: selected ? 'rgba(210,153,34,0.08)' : 'var(--bg)',
                  border: `1px solid ${selected ? 'var(--amber2)' : 'var(--border)'}`,
                  color: 'var(--text)', textAlign: 'left',
                  transition: 'all .15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
                  {selected && <Check size={14} style={{ color: 'var(--amber2)' }} />}
                </div>
                <span style={{ fontFamily: m.family, fontSize: 14, color: 'var(--text2)' }}>NT$ 12,345 / 06:30</span>
              </button>
            )
          })}
        </div>
        <div style={subText}>套用於所有金額、日期、車牌、編號等需要對齊的數字欄位。</div>
      </div>
    </div>
  )
}
