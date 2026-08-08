import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import ExcelJS from 'exceljs'

// 🌟 完美移植網頁版的時區處理，避免 UTC 跨日問題
function tpeMidnight(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d) - 8 * 3600 * 1000)
}

// 🌟 動態取得計費週期 (讀取資料庫的 start_day)
function getBillingCycle(year: number, monthIndex: number, startDay: number) {
  const sd = startDay || 1
  if (sd === 1) {
    return {
      start: tpeMidnight(year, monthIndex, 1),
      end: tpeMidnight(year, monthIndex + 1, 1)
    }
  }
  return {
    start: tpeMidnight(year, monthIndex - 1, sd),
    end: tpeMidnight(year, monthIndex, sd)
  }
}

// 🌟 取得自然月起訖
function getNaturalMonth(year: number, monthIndex: number) {
  return {
    start: tpeMidnight(year, monthIndex, 1),
    end: tpeMidnight(year, monthIndex + 1, 1)
  }
}

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const driverId = searchParams.get('driverId')
  const monthStr = searchParams.get('month')
  const yearStr = searchParams.get('year')

  if (!driverId || !monthStr || !yearStr) {
    return new Response('Missing parameters', { status: 400 })
  }

  // 轉換為 0-indexed 的月份 (7月 = 6)
  const targetMonth = parseInt(monthStr, 10) - 1
  const targetYear = parseInt(yearStr, 10)

  const { data: driver } = await supabase.from('drivers').select('name').eq('id', driverId).single()
  if (!driver) return new Response('Driver not found', { status: 404 })

  // 放寬撈取區間 (上個月 15 日 ~ 下個月 5 日)，確保涵蓋跨月週期
  const broadStart = tpeMidnight(targetYear, targetMonth - 1, 15).toISOString()
  const broadEnd = tpeMidnight(targetYear, targetMonth + 1, 5).toISOString()

  // 🌟 記得撈出 billing_cycle_start_day
  const { data: rawTrips, error } = await supabase
    .from('trips')
    .select(`
      id, departed_at, trip_count, actual_stops, final_fare, driver_final_fare, notes, destination_area, trip_code,
      vendors (name, billing_cycle_start_day),
      vendor_rate_rules (service_type)
    `)
    .eq('driver_id', driverId)
    .eq('status', 'completed')
    .gte('departed_at', broadStart)
    .lt('departed_at', broadEnd)
    .order('departed_at', { ascending: true })

  if (error) return new Response(error.message, { status: 500 })

  const billingTripsByVendor: Record<string, any[]> = {}
  const billingTotals: Record<string, number> = {}
  const naturalTotals: Record<string, number> = {}

  // 分類與計算
  for (const rawTrip of (rawTrips || [])) {
    const trip = rawTrip as any // 🌟 繞過 Supabase 的型別推斷限制
    
    // 🌟 保險邏輯：無論 Supabase 回傳的是陣列還是單一物件，都安全取出
    const v = Array.isArray(trip.vendors) ? trip.vendors[0] : trip.vendors
    
    const vendorName = v?.name || '未知廠商'
    const startDay = v?.billing_cycle_start_day ?? 1
    
    if (!trip.departed_at) continue
    const tripDate = new Date(trip.departed_at)
    const fare = Number(trip.final_fare || 0)
    
    // 1. 判斷是否落在「計費週期」內 (留意是 >= start 且 < end)
    const billing = getBillingCycle(targetYear, targetMonth, startDay)
    if (tripDate >= billing.start && tripDate < billing.end) {
      if (!billingTripsByVendor[vendorName]) {
        billingTripsByVendor[vendorName] = []
        billingTotals[vendorName] = 0
      }
      billingTripsByVendor[vendorName].push(trip)
      billingTotals[vendorName] += fare
    }

    // 2. 判斷是否落在「自然月」內
    const natural = getNaturalMonth(targetYear, targetMonth)
    if (tripDate >= natural.start && tripDate < natural.end) {
      if (!naturalTotals[vendorName]) naturalTotals[vendorName] = 0
      naturalTotals[vendorName] += fare
    }
  }

  // 繪製 Excel
  const workbook = new ExcelJS.Workbook()
  workbook.creator = '物流 ERP 系統'

  // --- Sheet 1: 計費週期總計 (發薪依據) ---
  const billingSheet = workbook.addWorksheet('總計(計費週期)')
  billingSheet.columns = [
    { header: '廠商', key: 'vendor', width: 25 },
    { header: '金額', key: 'amount', width: 20 }
  ]
  billingSheet.getRow(1).font = { bold: true }
  billingSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }

  let grandBillingTotal = 0
  for (const [vendor, total] of Object.entries(billingTotals)) {
    billingSheet.addRow({ vendor, amount: total })
    grandBillingTotal += total
  }
  const btRow = billingSheet.addRow({ vendor: '計費結算總計', amount: grandBillingTotal })
  btRow.font = { bold: true, color: { argb: 'FFD32F2F' } }
  billingSheet.getColumn('amount').numFmt = '#,##0'

  // --- Sheet 2: 自然月總計 (產能依據) ---
  const naturalSheet = workbook.addWorksheet('總計(自然月)')
  naturalSheet.columns = [
    { header: '廠商', key: 'vendor', width: 25 },
    { header: '金額', key: 'amount', width: 20 }
  ]
  naturalSheet.getRow(1).font = { bold: true }
  naturalSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } }

  let grandNaturalTotal = 0
  for (const [vendor, total] of Object.entries(naturalTotals)) {
    naturalSheet.addRow({ vendor, amount: total })
    grandNaturalTotal += total
  }
  const ntRow = naturalSheet.addRow({ vendor: '當月產能總計', amount: grandNaturalTotal })
  ntRow.font = { bold: true, color: { argb: 'FF1976D2' } }
  naturalSheet.getColumn('amount').numFmt = '#,##0'

  // --- 各廠商明細 Sheet (依計費週期) ---
  for (const [vendor, trips] of Object.entries(billingTripsByVendor)) {
    const detailSheet = workbook.addWorksheet(vendor)
    detailSheet.columns = [
      { header: '日期', key: 'date', width: 15 },
      { header: '業務類別', key: 'service', width: 15 },
      { header: '趟數', key: 'trips', width: 10 },
      { header: '站數', key: 'stops', width: 10 },
      { header: '運費', key: 'fare', width: 15 },
      { header: '備註', key: 'notes', width: 30 }
    ]

    detailSheet.getRow(1).font = { bold: true }
    detailSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7FA' } }

    for (const trip of trips) {
      // 🌟 同樣為 vendor_rate_rules 加上防呆處理
      const r = Array.isArray(trip.vendor_rate_rules) ? trip.vendor_rate_rules[0] : trip.vendor_rate_rules

      detailSheet.addRow({
        date: new Date(trip.departed_at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }),
        service: r?.service_type || '',
        trips: trip.trip_count,
        stops: trip.actual_stops || '',
        fare: trip.final_fare || 0,
        notes: trip.notes || ''
      })
    }
    detailSheet.getColumn('fare').numFmt = '#,##0'
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const filename = encodeURIComponent(`車趟紀錄_${driver.name}_${monthStr}月.xlsx`)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`
    }
  })
}
