'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Driver {
  id: string
  name: string
}

interface Props {
  drivers: Driver[]
}

export default function DriverFilter({ drivers }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // 從網址讀取目前的篩選狀態 (例如 ?driver=123)
  const currentDriverId = searchParams.get('driver') || ''

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    
    if (val) {
      params.set('driver', val)
    } else {
      params.delete('driver')
    }
    
    // 💡 貼心防呆：切換篩選條件時，把頁碼歸零回到第一頁，避免卡在空資料頁
    params.delete('page')
    
    // 更新網址，觸發 Server Page 重新渲染
    router.push(`?${params.toString()}`)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <select
        className="input"
        value={currentDriverId}
        onChange={handleChange}
        style={{ width: 140, padding: '6px 10px', fontSize: 13, cursor: 'pointer' }}
      >
        <option value="">👤 所有司機</option>
        {drivers.map(d => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  )
}
