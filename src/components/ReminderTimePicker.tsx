'use client'
import { useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'

interface Props {
  targetId: string
  initialEnabled: boolean
  initialTime: string // 格式: "20:00"
  onSave: (id: string, enabled: boolean, time: string) => Promise<{ error: string | null }>
}

export default function ReminderTimePicker({ targetId, initialEnabled, initialTime, onSave }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [time, setTime] = useState(initialTime.slice(0, 5)) // 確保是 "HH:MM"
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)
    const nextEnabled = !enabled
    const { error } = await onSave(targetId, nextEnabled, time)
    if (!error) setEnabled(nextEnabled)
    else alert(`設定失敗：${error}`)
    setLoading(false)
  }

  async function handleTimeChange(newTime: string) {
    setTime(newTime)
    setLoading(true)
    const { error } = await onSave(targetId, enabled, newTime)
    if (error) alert(`時間儲存失敗：${error}`)
    setLoading(false)
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {/* 鈴鐺切換按鈕 */}
      <button
        type="button"
        className={`badge ${enabled ? 'badge-green' : 'badge-red'}`}
        style={{ border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px' }}
        disabled={loading}
        onClick={handleToggle}
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : enabled ? <Bell size={12} /> : <BellOff size={12} />}
        {enabled ? '啟報' : '停報'}
      </button>

      {/* 時間選擇器 (只有啟用時才亮起可選) */}
      <input
        type="time"
        className="input"
        style={{ 
          padding: '2px 6px', 
          fontSize: 13, 
          width: 90, 
          opacity: enabled ? 1 : 0.4, 
          pointerEvents: enabled ? 'auto' : 'none' 
        }}
        value={time}
        onChange={e => handleTimeChange(e.target.value)}
        disabled={loading}
      />
    </div>
  )
}
