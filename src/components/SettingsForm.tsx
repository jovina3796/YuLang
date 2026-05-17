'use client'
import { useEffect, useState } from 'react'
import { Check, Palette, Type, Hash, RotateCcw } from 'lucide-react'

type AccentKey = 'green' | 'blue' | 'purple' | 'amber' | 'red' | 'cyan'
type FontKey   = 'noto' | 'system' | 'lxgw' | 'serif'
type MonoKey   = 'dm' | 'jetbrain' | 'fira' | 'ibm' | 'roboto'

const ACCENTS: { key: AccentKey; label: string; swatch: string }[] = [
  { key: 'green',  label: '森林綠',   swatch: '#3fb950' },
  { key: 'blue',   label: '海洋藍',   swatch: '#388bfd' },
  { key: 'purple', label: '丁香紫',   swatch: '#a371f7' },
  { key: 'amber',  label: '琥珀黃',   swatch: '#d29922' },
  { key: 'red',    label: '珊瑚紅',   swatch: '#f85149' },
  { key: 'cyan',   label: '青瓷藍',   swatch: '#22b8cf' },
]

const FONTS: { key: FontKey; label: string; sample: string; family: string }[] = [
  { key: 'noto',   label: '思源黑體', sample: '馭浪物流 OMS Yulang 0123', family: "'Noto Sans TC', sans-serif" },
  { key: 'system', label: '系統預設', sample: '馭浪物流 OMS Yulang 0123', family: "-apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif" },
  { key: 'lxgw',   label: '霞鶩文楷', sample: '馭浪物流 OMS Yulang 0123', family: "'LXGW WenKai TC', 'Noto Sans TC', sans-serif" },
  { key: 'serif',  label: '思源宋體', sample: '馭浪物流 OMS Yulang 0123', family: "'Noto Serif TC', 'Songti TC', serif" },
]

const MONOS: { key: MonoKey; label: string; family: string }[] = [
  { key: 'dm',       label: 'DM Mono',        family: "'DM Mono', monospace" },
  { key: 'jetbrain', label: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
  { key: 'fira',     label: 'Fira Code',      family: "'Fira Code', monospace" },
  { key: 'ibm',      label: 'IBM Plex Mono',  family: "'IBM Plex Mono', monospace" },
  { key: 'roboto',   label: 'Roboto Mono',    family: "'Roboto Mono', monospace" },
]

export default function SettingsForm() {
  const [accent, setAccent] = useState<AccentKey>('green')
  const [font,   setFont]   = useState<FontKey>('noto')
  const [mono,   setMono]   = useState<MonoKey>('dm')

  useEffect(() => {
    setAccent((localStorage.getItem('accent') as AccentKey | null) ?? 'green')
    setFont(  (localStorage.getItem('font')   as FontKey   | null) ?? 'noto')
    setMono(  (localStorage.getItem('mono')   as MonoKey   | null) ?? 'dm')
  }, [])

  function applyAccent(key: AccentKey) {
    setAccent(key)
    document.documentElement.setAttribute('data-accent', key)
    localStorage.setItem('accent', key)
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
        </div>
        <div style={subText}>影響按鈕、連結、KPI 數字等強調色彩。儲存後立即套用，並會記住您的選擇。</div>
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
