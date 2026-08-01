'use client'

import { Download } from 'lucide-react'
import { exportTripsByVendor } from '@/lib/exportExcel'

interface Props {
  trips: any[]
  startDate: string
  endDate: string
  driverName: string
}

export default function TripExportButton({ trips, startDate, endDate, driverName }: Props) {
  const handleExport = () => {
    exportTripsByVendor({ trips, startDate, endDate, driverName })
  }

  return (
    <button 
      onClick={handleExport}
      className="btn" // 如果你有自訂 btn-primary 可以加上去
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '6px',
        padding: '6px 12px',
        background: '#006030',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px'
      }}
      title="依照查詢條件匯出對帳用 Excel"
    >
      <Download size={16} />
      匯出對帳單
    </button>
  )
}
