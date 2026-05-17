import { createServiceClient } from '@/lib/supabase/service'
import ScheduleFormModal from '@/components/ScheduleFormModal'
import ScheduleRowActions from '@/components/ScheduleRowActions'
import ScheduleCalendar from '@/components/ScheduleCalendar'
import SortableTh from '@/components/SortableTh'

const STATUS: Record<string, { label: string; cls: string }> = {
  scheduled:   { label: '已排班', cls: 'badge-blue'  },
  in_progress: { label: '進行中', cls: 'badge-amber' },
  completed:   { label: '已完成', cls: 'badge-green' },
  cancelled:   { label: '已取消', cls: 'badge-red'   },
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; ym?: string }>
}) {
  const supabase = createServiceClient()
  const { sort, dir, ym } = await searchParams
  const sortField = sort ?? 'scheduled_date'
  const ascending = (dir ?? 'desc') === 'asc'

  const now = new Date()
  const [yyStr, mmStr] = (ym && /^\d{4}-\d{1,2}$/.test(ym)) ? ym.split('-') : []
  const calYear  = yyStr ? Number(yyStr) : now.getFullYear()
  const calMonth = mmStr ? Number(mmStr) - 1 : now.getMonth()
  const monthStart = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`
  const monthEnd   = `${calMonth === 11 ? calYear + 1 : calYear}-${String(((calMonth + 1) % 12) + 1).padStart(2, '0')}-01`

  const todayD = new Date()
  const today = `${todayD.getFullYear()}-${String(todayD.getMonth() + 1).padStart(2, '0')}-${String(todayD.getDate()).padStart(2, '0')}`
  const wk = new Date(todayD.getFullYear(), todayD.getMonth(), todayD.getDate() + 7)
  const weekLater = `${wk.getFullYear()}-${String(wk.getMonth() + 1).padStart(2, '0')}-${String(wk.getDate()).padStart(2, '0')}`

  const [
    { data: monthSchedules },
    { data: weekSchedules },
    { data: allSchedules },
    { data: drivers },
    { data: vehicles },
  ] = await Promise.all([
    supabase.from('schedules')
      .select('driver_id, scheduled_date, shift')
      .gte('scheduled_date', monthStart).lt('scheduled_date', monthEnd),
    supabase.from('schedules')
      .select('*, drivers(name), vehicles(plate_number)')
      .gte('scheduled_date', today).lte('scheduled_date', weekLater)
      .order('scheduled_date').order('shift'),
    supabase.from('schedules')
      .select('*, drivers(name), vehicles(plate_number)')
      .lt('scheduled_date', today)
      .order('scheduled_date', { ascending: false })
      .limit(50),
    supabase.from('drivers').select('id, name').eq('status', 'active').eq('show_in_schedule', true)
      .order('display_order', { ascending: true, nullsFirst: false }).order('name'),
    supabase.from('vehicles').select('id, plate_number')
      .order('display_order', { ascending: true, nullsFirst: false }).order('plate_number'),
  ])

  // Build calendar shiftMap[driverId][isoDate] = shift
  const shiftMap: Record<string, Record<string, string>> = {}
  ;(monthSchedules ?? []).forEach((s: any) => {
    if (!shiftMap[s.driver_id]) shiftMap[s.driver_id] = {}
    shiftMap[s.driver_id][s.scheduled_date] = s.shift ?? '出勤'
  })

  // Weekly grouping
  const byDate: Record<string, any[]> = {}
  weekSchedules?.forEach(s => {
    if (!byDate[s.scheduled_date]) byDate[s.scheduled_date] = []
    byDate[s.scheduled_date]!.push(s)
  })
  const dateLabels: Record<string, string> = {}
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  weekSchedules?.forEach(s => {
    if (!dateLabels[s.scheduled_date]) {
      const d = new Date(s.scheduled_date)
      dateLabels[s.scheduled_date] = `${s.scheduled_date}（${weekdays[d.getDay()]}）`
    }
  })
  const upcomingDates = Object.keys(byDate).sort()

  const getKey = (s: any): string | number => {
    switch (sortField) {
      case 'scheduled_date': return s.scheduled_date ?? ''
      case 'shift':          return s.shift ?? ''
      case 'driver':         return s.drivers?.name ?? ''
      case 'vehicle':        return s.vehicles?.plate_number ?? ''
      case 'status':         return s.status ?? ''
      default:               return ''
    }
  }
  const sortedAll = [...(allSchedules ?? [])].sort((a, b) => {
    const av = getKey(a), bv = getKey(b)
    if (av === bv) return 0
    if (typeof av === 'number' && typeof bv === 'number') return ascending ? av - bv : bv - av
    const cmp = String(av).localeCompare(String(bv), 'zh-Hant')
    return ascending ? cmp : -cmp
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ScheduleFormModal drivers={drivers ?? []} vehicles={vehicles ?? []} mode="create" />
      </div>

      <ScheduleCalendar
        year={calYear}
        month={calMonth}
        drivers={drivers ?? []}
        shiftMap={shiftMap}
      />

      <div>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginBottom: 12, letterSpacing: 1 }}>
          本週排班（今日起 7 天）
        </div>
        {upcomingDates.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
            本週暫無排班資料
          </div>
        ) : upcomingDates.map(date => (
          <div key={date} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, paddingLeft: 4 }}>
              {dateLabels[date]}
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center' }}>班次</th>
                    <th style={{ textAlign: 'center' }}>司機</th>
                    <th style={{ textAlign: 'center' }}>車牌</th>
                    <th style={{ textAlign: 'center' }}>狀態</th>
                    <th style={{ width: 80, textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {byDate[date]!.map((s: any) => {
                    const st = STATUS[s.status] ?? { label: s.status, cls: 'badge-blue' }
                    return (
                      <tr key={s.id}>
                        <td className="mono" style={{ textAlign: 'center' }}>{s.shift ?? ''}</td>
                        <td className="name" style={{ textAlign: 'center' }}>{s.drivers?.name ?? ''}</td>
                        <td className="mono" style={{ textAlign: 'center' }}>{s.vehicles?.plate_number ?? ''}</td>
                        <td style={{ textAlign: 'center' }}><span className={`badge ${st.cls}`}>{st.label}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          <ScheduleRowActions
                            schedule={{
                              id: s.id,
                              driver_id: s.driver_id,
                              vehicle_id: s.vehicle_id ?? null,
                              scheduled_date: s.scheduled_date,
                              shift: s.shift ?? null,
                              status: s.status,
                            }}
                            drivers={drivers ?? []}
                            vehicles={vehicles ?? []}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {(allSchedules?.length ?? 0) > 0 && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginBottom: 12, letterSpacing: 1 }}>
            歷史排班紀錄
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <SortableTh field="scheduled_date" defaultField="scheduled_date" defaultDir="desc" align="center">日期</SortableTh>
                  <SortableTh field="shift" defaultField="scheduled_date" defaultDir="desc" align="center">班次</SortableTh>
                  <SortableTh field="driver" defaultField="scheduled_date" defaultDir="desc" align="center">司機</SortableTh>
                  <SortableTh field="vehicle" defaultField="scheduled_date" defaultDir="desc" align="center">車牌</SortableTh>
                  <SortableTh field="status" defaultField="scheduled_date" defaultDir="desc" align="center">狀態</SortableTh>
                  <th style={{ width: 80, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedAll.map((s: any) => {
                  const st = STATUS[s.status] ?? { label: s.status, cls: 'badge-blue' }
                  return (
                    <tr key={s.id}>
                      <td className="mono" style={{ textAlign: 'center' }}>{s.scheduled_date}</td>
                      <td className="mono" style={{ textAlign: 'center' }}>{s.shift ?? ''}</td>
                      <td className="name" style={{ textAlign: 'center' }}>{s.drivers?.name ?? ''}</td>
                      <td className="mono" style={{ textAlign: 'center' }}>{s.vehicles?.plate_number ?? ''}</td>
                      <td style={{ textAlign: 'center' }}><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <ScheduleRowActions
                          schedule={{
                            id: s.id,
                            driver_id: s.driver_id,
                            vehicle_id: s.vehicle_id ?? null,
                            scheduled_date: s.scheduled_date,
                            shift: s.shift ?? null,
                            status: s.status,
                          }}
                          drivers={drivers ?? []}
                          vehicles={vehicles ?? []}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
