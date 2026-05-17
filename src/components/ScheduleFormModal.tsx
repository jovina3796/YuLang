'use client'
import { useState } from 'react'
import { PencilLine, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createSchedule, updateSchedule, type ScheduleInput } from '@/app/(dashboard)/schedule/actions'

type Driver  = { id: string; name: string }
type Vehicle = { id: string; plate_number: string }

export type ScheduleRow = {
  id:             string
  driver_id:      string
  vehicle_id:     string | null
  scheduled_date: string
  shift:          string | null
  status:         string
}

interface Props {
  drivers:  Driver[]
  vehicles: Vehicle[]
  mode:     'create' | 'edit'
  initial?: ScheduleRow
  trigger?: React.ReactNode
}

export default function ScheduleFormModal({ drivers, vehicles, mode, initial, trigger }: Props) {
  const router = useRouter()
  const today  = new Date().toISOString().split('T')[0]

  const [open,       setOpen]       = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [driverId,   setDriverId]   = useState(initial?.driver_id ?? '')
  const [vehicleId,  setVehicleId]  = useState(initial?.vehicle_id ?? '')
  const [date,       setDate]       = useState(initial?.scheduled_date ?? today)
  const [shift,      setShift]      = useState(initial?.shift ?? '')
  const [status,     setStatus]     = useState(initial?.status ?? 'scheduled')

  function resetForm() {
    if (mode === 'create') {
      setDriverId(''); setVehicleId(''); setDate(today); setShift(''); setStatus('scheduled')
    }
  }

  async function handleSubmit() {
    if (!driverId || !date) return
    const payload: ScheduleInput = {
      driver_id:      driverId,
      vehicle_id:     vehicleId || null,
      scheduled_date: date,
      shift:          shift.trim() || null,
      status,
    }
    setSaving(true)
    const { error } = mode === 'create'
      ? await createSchedule(payload)
      : await updateSchedule(initial!.id, payload)
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); resetForm(); router.refresh()
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }

  const defaultTrigger = mode === 'create'
    ? <button className="btn btn-primary" onClick={() => setOpen(true)} title="新增排班" style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px' }}><Plus size={16} /></button>
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
            borderRadius: 14, width: '100%', maxWidth: 480,
            padding: '28px 28px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {mode === 'create' ? '新增排班' : '編輯排班'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>排班日期</span>
                <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
              </label>
              <label style={L}>
                <span style={LT}>班次</span>
                <input
                  type="text" className="input" value={shift}
                  onChange={e => setShift(e.target.value)} placeholder="例：早班 / 08:00-17:00"
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={L}>
                <span style={LT}>司機</span>
                <select className="input" value={driverId} onChange={e => setDriverId(e.target.value)}>
                  <option value="">— 選擇司機 —</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label style={L}>
                <span style={LT}>車輛</span>
                <select className="input" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                  <option value="">— 未指派 —</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
                </select>
              </label>
            </div>

            <label style={L}>
              <span style={LT}>狀態</span>
              <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="scheduled">已排班</option>
                <option value="in_progress">進行中</option>
                <option value="completed">已完成</option>
                <option value="cancelled">已取消</option>
              </select>
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={() => { setOpen(false); resetForm() }}>取消</button>
              <button
                className="btn btn-primary"
                disabled={!driverId || !date || saving}
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
