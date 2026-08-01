import * as XLSX from 'xlsx'

// 定義傳入的資料格式 (請依照你實際的 Trip 型別微調)
interface ExportParams {
  trips: any[]          // 畫面上查詢出來的車趟資料陣列
  startDate: string     // 查詢的起日 (YYYY-MM-DD)
  endDate: string       // 查詢的迄日 (YYYY-MM-DD)
  driverName: string    // 查詢的司機姓名 (若無選定則傳空字串)
}

export function exportTripsByVendor({ trips, startDate, endDate, driverName }: ExportParams) {
  if (!trips || trips.length === 0) {
    alert('沒有可匯出的資料！')
    return
  }

  // 1. 先將資料依日期 (departed_at) 由舊到新排序
  const sortedTrips = [...trips].sort((a, b) => {
    const dateA = new Date(a.departed_at || 0).getTime()
    const dateB = new Date(b.departed_at || 0).getTime()
    return dateA - dateB
  })

  // 2. 將資料依照「廠商名稱」分組
  const groupedData: Record<string, any[]> = {}
  
  sortedTrips.forEach(trip => {
    const vendorName = trip.vendors?.name || '未指定廠商'
    
    if (!groupedData[vendorName]) {
      groupedData[vendorName] = []
    }

    // 🌟 在這裡自訂 Excel 裡面要顯示的欄位與順序
    groupedData[vendorName].push({
      '日期': trip.departed_at ? new Date(trip.departed_at).toLocaleDateString('zh-TW') : '',
      '司機姓名': trip.drivers?.name || '',
      '業務': trip.vendor_rate_rules?.service_type || '未指定',
      '趟數': trip.trip_count || 1,
      '區域': trip.destination_area || '-',
      '店點/籃件': trip.actual_stops || '',
      '特殊加成': trip.surcharge_name || '-',
      'KPI達標': trip.is_kpi_achieved ? 'V' : '',
      '結算運費': trip.final_fare || 0,
      '備註': trip.notes || ''
    })
  })

  // 3. 建立 Excel 活頁簿
  const workbook = XLSX.utils.book_new()

  // 4. 將每個廠商的資料轉換成分頁 (Sheet)
  Object.keys(groupedData).forEach(vendor => {
    const worksheet = XLSX.utils.json_to_sheet(groupedData[vendor])
    
    // 設定欄寬 (選用，讓版面更好看)
    const colWidths = [
      { wch: 12 }, // 日期
      { wch: 15 }, // 司機姓名
      { wch: 15 }, // 業務
      { wch: 8 }, // 趟數
      { wch: 15 },  // 區域
      { wch: 15 },  // 店點/籃件
      { wch: 15 },  // 特殊加成
      { wch: 8 },  // KPI
      { wch: 10 }, // 結算運費
      { wch: 20 }, // 備註
    ]
    worksheet['!cols'] = colWidths

    XLSX.utils.book_append_sheet(workbook, worksheet, vendor)
  })

  // 5. 組合檔案名稱：查詢區間_司機姓名.xlsx
  const safeStartDate = startDate || '起'
  const safeEndDate = endDate || '迄'
  const safeDriver = driverName || '全體司機'
  const fileName = `${safeStartDate}~${safeEndDate}_${safeDriver}.xlsx`

  // 6. 觸發瀏覽器下載檔案
  XLSX.writeFile(workbook, fileName)
}
