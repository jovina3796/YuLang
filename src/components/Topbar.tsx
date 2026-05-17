'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/dashboard':   '儀表板',
  '/trips':       '車趟紀錄',
  '/vehicles':    '車輛列表',
  '/drivers':     '人員列表',
  '/schedule':    '排班設定',
  '/claims':      '請款簽核',
  '/leaves':      '請假簽核',
  '/overtimes':   '加班簽核',
  '/fuel':        '加油紀錄',
  '/maintenance': '保養維修',
  '/gps':         'GPS查詢',
  '/inspection':  '驗車紀錄',
  '/reports':     '統計報表',
  '/fixed':       '固定收支',
  '/misc':        '其他收支',
  '/payroll':     '薪資單據',
  '/vendors':     '廠商設定',
  '/rates':       '運費設定',
  '/settings':    '設定',
}

export default function Topbar() {
  const pathname = usePathname() ?? '/dashboard'
  const [now, setNow] = useState<{ date: string; time: string } | null>(null)

  useEffect(() => {
    const update = () => {
      const d = new Date()
      setNow({
        date:
          d.getFullYear() + '-' +
          String(d.getMonth() + 1).padStart(2, '0') + '-' +
          String(d.getDate()).padStart(2, '0'),
        time:
          String(d.getHours()).padStart(2, '0') + ':' +
          String(d.getMinutes()).padStart(2, '0'),
      })
    }
    update()
    const id = setInterval(update, 1000 * 30)
    return () => clearInterval(id)
  }, [])

  const title =
    pageTitles[pathname] ??
    pageTitles[Object.keys(pageTitles).find((p) => pathname.startsWith(p + '/')) ?? ''] ??
    '管理後台'

  return (
    <header style={{
      height: 52, background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 16,
      position: 'sticky', top: 0, zIndex: 5,
    }}>
      <span style={{ fontSize: 15, fontWeight: 500 }}>{title}</span>
      <div style={{ flex: 1 }} />
      {now && (
        <span style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
          現在時間：
          <span style={{ color: 'var(--text)', fontWeight: 700 }}>
            {now.date}  {now.time}
          </span>{' '}
          (UTC+8)
        </span>
      )}
    </header>
  )
}
