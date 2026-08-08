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

// 🌟 定義總計表的資料結構
type AggRow = {
  vendor: string
  service: string
  fare: number
  commRate: number
  net: number
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

  // 放寬撈取區間，確保涵蓋跨月週期
  const broadStart = tpeMidnight(targetYear, targetMonth - 1, 15).toISOString()
  const broadEnd = tpeMidnight(targetYear, targetMonth + 1, 5).toISOString()

  // 🌟 新增撈取 commission_rate, destination_area, driver_final_fare
  const { data: rawTrips, error } = await supabase
    .from('trips')
    .select(`
      id, departed_at, trip_count, actual_stops, final_fare, destination_area, notes, commission_rate, driver_final_fare,
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
  
  // 🌟 使用新的 AggRow 結構來儲存分組總計 (依照廠商+業務+抽成)
  const billingAgg: Record<string, AggRow> = {}
  const naturalAgg: Record<string, AggRow> = {}

  // 分類與計算
  for (const rawTrip of (rawTrips || [])) {
    const trip = rawTrip as any
    const v = Array.isArray(trip.vendors) ? trip.vendors[0] : trip.vendors
    const r = Array.isArray(trip.vendor_rate_rules) ? trip.vendor_rate_rules[0] : trip.vendor_rate_rules
    
    const vendorName = v?.name || '未知廠商'
    const serviceType = r?.service_type || '一般業務'
    const startDay = v?.billing_cycle_start_day ?? 1
    
    if (!trip.departed_at) continue
    const tripDate = new Date(trip.departed_at)
    
    const fare = Number(trip.final_fare || 0)
    const commRate = Number(trip.commission_rate || 0)
    // 若沒有紀錄實領金額，用運費扣除抽成計算
    const net = Number(trip.driver_final_fare || (fare * (1 - commRate)))
    
    // 組合鍵值 (避免同一廠商有不同業務或不同抽成混在一起)
    const aggKey = `${vendorName}|${serviceType}|${commRate}`

    // 1. 判斷是否落在「計費週期」內
    const billing = getBillingCycle(targetYear, targetMonth, startDay)
    if (tripDate >= billing.start && tripDate < billing.end) {
      if (!billingTripsByVendor[vendorName]) billingTripsByVendor[vendorName] = []
      billingTripsByVendor[vendorName].push(trip)

      if (!billingAgg[aggKey]) billingAgg[aggKey] = { vendor: vendorName, service: serviceType, fare: 0, commRate, net: 0 }
      billingAgg[aggKey].fare += fare
      billingAgg[aggKey].net += net
    }

    // 2. 判斷是否落在「自然月」內
    const natural = getNaturalMonth(targetYear, targetMonth)
    if (tripDate >= natural.start && tripDate < natural.end) {
      if (!naturalAgg[aggKey]) naturalAgg[aggKey] = { vendor: vendorName, service: serviceType, fare: 0, commRate, net: 0 }
      naturalAgg[aggKey].fare += fare
      naturalAgg[aggKey].net += net
    }
  }

  // 繪製 Excel
  const workbook = new ExcelJS.Workbook()
  workbook.creator = ' YuLang ERP'

  // ==========================================
  // Sheet 1: 計費週期總計 (發薪依據)
  // ==========================================
  const billingSheet = workbook.addWorksheet('總計(計費週期)')
  billingSheet.columns = [
    { header: '廠商', key: 'vendor', width: 20 },
    { header: '業務', key: 'service', width: 15 },
    { header: '運費金額', key: 'fare', width: 15 },
    { header: '上游抽成比例', key: 'commRate', width: 15 },
    { header: '實領金額', key: 'net', width: 15 }
  ]
  billingSheet.getRow(1).font = { bold: true }
  billingSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }

  let grandBillingNet = 0
  for (const row of Object.values(billingAgg)) {
    billingSheet.addRow({
      vendor: row.vendor,
      service: row.service,
      fare: row.fare,
      commRate: `${(row.commRate * 100).toFixed(0)}%`, // 顯示為 20%
      net: row.net
    })
    grandBillingNet += row.net
  }
  const btRow = billingSheet.addRow({ vendor: '計費結算總計', service: '', fare: '', commRate: '', net: grandBillingNet })
  btRow.font = { bold: true, color: { argb: 'FFD32F2F' } }
  billingSheet.getColumn('fare').numFmt = '#,##0'
  billingSheet.getColumn('net').numFmt = '#,##0'

  // ==========================================
  // Sheet 2: 自然月總計 (產能依據)
  // ==========================================
  const naturalSheet = workbook.addWorksheet('總計(自然月)')
  naturalSheet.columns = [
    { header: '廠商', key: 'vendor', width: 20 },
    { header: '業務', key: 'service', width: 15 },
    { header: '運費金額', key: 'fare', width: 15 },
    { header: '上游抽成比例', key: 'commRate', width: 15 },
    { header: '實領金額', key: 'net', width: 15 }
  ]
  naturalSheet.getRow(1).font = { bold: true }
  naturalSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } }

  let grandNaturalNet = 0
  for (const row of Object.values(naturalAgg)) {
    naturalSheet.addRow({
      vendor: row.vendor,
      service: row.service,
      fare: row.fare,
      commRate: `${(row.commRate * 100).toFixed(0)}%`,
      net: row.net
    })
    grandNaturalNet += row.net
  }
  const ntRow = naturalSheet.addRow({ vendor: '當月產能總計', service: '', fare: '', commRate: '', net: grandNaturalNet })
  ntRow.font = { bold: true, color: { argb: 'FF1976D2' } }
  naturalSheet.getColumn('fare').numFmt = '#,##0'
  naturalSheet.getColumn('net').numFmt = '#,##0'

  // ==========================================
  // 各廠商明細 Sheet (依計費週期)
  // ==========================================
  for (const [vendor, trips] of Object.entries(billingTripsByVendor)) {
    const detailSheet = workbook.addWorksheet(vendor)
    detailSheet.columns = [
      { header: '日期', key: 'date', width: 15 },
      { header: '業務', key: 'service', width: 15 },
      { header: '地區', key: 'area', width: 15 },
      { header: '店點數', key: 'stops', width: 10 },
      { header: '趟數', key: 'trips', width: 10 },
      { header: '運費', key: 'fare', width: 15 },
      { header: '備註', key: 'notes', width: 30 }
    ]

    detailSheet.getRow(1).font = { bold: true }
    detailSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7FA' } }

    let detailTotalFare = 0
    for (const trip of trips) {
      const r = Array.isArray(trip.vendor_rate_rules) ? trip.vendor_rate_rules[0] : trip.vendor_rate_rules
      const fare = Number(trip.final_fare || 0)
      
      detailSheet.addRow({
        date: new Date(trip.departed_at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }),
        service: r?.service_type || '',
        area: trip.destination_area || '',
        stops: trip.actual_stops || '',
        trips: trip.trip_count || 1,
        fare: fare,
        notes: trip.notes || ''
      })
      detailTotalFare += fare
    }
    
    // 🌟 在明細表最下方加入總計列
    const dTotalRow = detailSheet.addRow({
      date: '總計', service: '', area: '', stops: '', trips: '', fare: detailTotalFare, notes: ''
    })
    dTotalRow.font = { bold: true, color: { argb: 'FF2E7D32' } } // 綠色粗體
    
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
