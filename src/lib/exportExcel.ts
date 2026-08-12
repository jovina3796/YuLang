// 🌟 已經不需要 import * as XLSX from 'xlsx' 了！

interface ExportParams {
  trips: any[]      // 畫面上查詢出來的車趟資料陣列
  startDate: string // 查詢的起日 (YYYY-MM-DD)
  endDate: string   // 查詢的迄日 (YYYY-MM-DD)
  driverName: string// 查詢的司機姓名 (若無選定則傳空字串)
}

export function exportTripsByVendor({ trips, startDate, driverName }: ExportParams) {
  if (!trips || trips.length === 0) {
    alert('沒有可匯出的資料！')
    return
  }

  // 1. 確保有指定司機 (因為我們設計的 LINE 報表是專屬於「單一司機」的抽成對帳單)
  if (!driverName) {
    alert('⚠️ 請先在上方條件「選擇一位特定司機」，才能匯出專屬對帳單！')
    return
  }

  // 2. 從畫面上的 trips 資料中，反向抓出這位司機的 ID
  // (通常關聯查詢會帶在 driver_id 或 drivers.id 裡面)
  const targetTrip = trips.find(t => t.drivers?.name === driverName || t.driver_id)
  const driverId = targetTrip?.driver_id || targetTrip?.drivers?.id

  if (!driverId) {
    alert('無法取得司機 ID，請確認資料是否完整。')
    return
  }

  if (!startDate) {
    alert('請選擇起始日期，系統將依照起始日的「月份」來產生對帳單！')
    return
  }

  // 3. 從 startDate 提取年份與月份 (例如 '2026-06-01' -> 2026 年 6 月)
  const dateObj = new Date(startDate)
  const year = dateObj.getFullYear()
  const month = dateObj.getMonth() + 1

  // 4. 組合下載網址，呼叫我們寫好的神級 API
  const downloadUrl = `/api/export/driver-trips?driverId=${driverId}&year=${year}&month=${month}`

  // 5. 觸發瀏覽器下載 (因為 API 有設定 Content-Disposition，會直接下載而不會跳轉頁面)
  window.location.href = downloadUrl
}
