import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { calculateTripCommission } from '@/lib/finance/commission'
import ExcelJS from 'exceljs'

// 🌟 完美移植網頁版的時區處理，避免 UTC 跨日問題
function tpeMidnight(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d) - 8 * 3600 * 1000)
}

function getBillingCycle(year: number, monthIndex: number, startDay: number) {
  const sd = startDay || 1
  if (sd === 1) {
    return { start: tpeMidnight(year, monthIndex, 1), end: tpeMidnight(year, monthIndex + 1, 1) }
  }
  return { start: tpeMidnight(year, monthIndex - 1, sd), end: tpeMidnight(year, monthIndex, sd) }
}

function getNaturalMonth(year: number, monthIndex: number) {
  return { start: tpeMidnight(year, monthIndex, 1), end: tpeMidnight(year, monthIndex + 1, 1) }
}

type AggRow = {
  vendor: string
  service: string
  fare: number
  commRate: number
  net: number
}

// 🌟 定義全域預設字體：使用微軟正黑體，大小 11
const DEFAULT_FONT = { name: '微軟正黑體', size: 11 }

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const driverId = searchParams.get('driverId')
  const monthStr = searchParams.get('month')
  const yearStr = searchParams.get('year')

  if (!driverId || !monthStr || !yearStr) {
    return new Response('Missing parameters', { status: 400 })
  }

  const targetMonth = parseInt(monthStr, 10) - 1
  const targetYear = parseInt(yearStr, 10)

  const { data: driver } = await supabase.from('drivers').select('name').eq('id', driverId).single()
  if (!driver) return new Response('Driver not found', { status: 404 })

  const broadStart = tpeMidnight(targetYear, targetMonth - 1, 15).toISOString()
  const broadEnd = tpeMidnight(targetYear, targetMonth + 1, 5).toISOString()

  const { data: rawTrips, error } = await supabase
    .from('trips')
    .select(`
      id, departed_at, trip_count, actual_stops, final_fare, destination_area, notes, vendor_id, trip_code,
      vendors (name, billing_cycle_start_day),
      vendor_rate_rules (service_type)
    `)
    .eq('driver_id', driverId)
    .eq('status', 'completed')
    .gte('departed_at', broadStart)
    .lt('departed_at', broadEnd)
    .order('departed_at', { ascending: true })

  if (error) return new Response(error.message, { status: 500 })

  const vendorCommRates: Record<string, number> = {}
  for (const rawTrip of (rawTrips || [])) {
    const trip = rawTrip as any
    const vendorId = trip.vendor_id
    if (vendorId && vendorCommRates[vendorId] === undefined) {
      const info = await calculateTripCommission(driverId, vendorId, 100)
      vendorCommRates[vendorId] = info.commission_rate || 0
    }
  }

  const detailTripsByVendor: Record<string, any[]> = {}
  const billingAgg: Record<string, AggRow> = {}

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
    
    const commRate = trip.vendor_id ? (vendorCommRates[trip.vendor_id] || 0) : 0
    const net = fare * (1 - commRate / 100)
    
    const aggKey = `${vendorName}|${serviceType}`

    const billing = getBillingCycle(targetYear, targetMonth, startDay)
    const inBilling = tripDate >= billing.start && tripDate < billing.end

    const natural = getNaturalMonth(targetYear, targetMonth)
    const inNatural = tripDate >= natural.start && tripDate < natural.end

    // 加入明細表 (只要符合其一就列入)
    if (inBilling || inNatural) {
      if (!detailTripsByVendor[vendorName]) detailTripsByVendor[vendorName] = []
      detailTripsByVendor[vendorName].push({ ...trip, inBilling })
    }

    // 加入計費總計表 (只有符合計費週期的才計入)
    if (inBilling) {
      if (!billingAgg[aggKey]) billingAgg[aggKey] = { vendor: vendorName, service: serviceType, fare: 0, commRate, net: 0 }
      billingAgg[aggKey].fare += fare
      billingAgg[aggKey].net += net
    }
  }

  // 繪製 Excel
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'YuLang ERP'

  // ==========================================
  // Sheet 1: 計費結算總計 (發薪依據)
  // ==========================================
  const billingSheet = workbook.addWorksheet('計費結算總計')
  billingSheet.columns = [
    { header: '廠商', key: 'vendor', width: 20 },
    { header: '業務', key: 'service', width: 15 },
    { header: '運費金額', key: 'fare', width: 15 },
    { header: '上游抽成比例', key: 'commRate', width: 15 },
    { header: '實領金額', key: 'net', width: 15 }
  ]
  
  // 套用預設字體
  billingSheet.columns.forEach(col => { if (col) col.font = DEFAULT_FONT })
  billingSheet.getRow(1).font = { ...DEFAULT_FONT, bold: true }
  billingSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }

  // 🌟 將資料依廠商分組，為合併儲存格做準備
  const groupedBilling = Object.values(billingAgg).reduce((acc, row) => {
    if (!acc[row.vendor]) acc[row.vendor] = []
    acc[row.vendor].push(row)
    return acc
  }, {} as Record<string, AggRow[]>)

  let grandBillingNet = 0

  // 🌟 逐一印出各廠商資料，並動態合併儲存格
  for (const [vendor, rows] of Object.entries(groupedBilling)) {
    // 記錄這個廠商寫入的起始行號
    const startRow = billingSheet.rowCount + 1

    // 依序寫入業務明細
    rows.forEach(row => {
      billingSheet.addRow({
        vendor: row.vendor,
        service: row.service,
        fare: row.fare,
        commRate: `${row.commRate.toFixed(0)}%`, 
        net: row.net
      })
      grandBillingNet += row.net
    })

    // 記錄結束行號
    const endRow = billingSheet.rowCount

    // 如果該廠商有 2 筆以上的業務，執行儲存格合併
    if (endRow > startRow) {
      // 合併 A 欄 (廠商)
      billingSheet.mergeCells(`A${startRow}:A${endRow}`)
      // 合併 D 欄 (上游抽成比例)
      billingSheet.mergeCells(`D${startRow}:D${endRow}`)
    }

    // 將合併後的儲存格設定為垂直與水平置中
    const vendorCell = billingSheet.getCell(`A${startRow}`)
    const commRateCell = billingSheet.getCell(`D${startRow}`)
    vendorCell.alignment = { vertical: 'middle', horizontal: 'center' }
    commRateCell.alignment = { vertical: 'middle', horizontal: 'center' }
  }

  // 寫入最底部的總計
  const btRow = billingSheet.addRow({ vendor: '計費結算總計', service: '', fare: '', commRate: '', net: grandBillingNet })
  btRow.font = { ...DEFAULT_FONT, bold: true, color: { argb: 'FFD32F2F' } } 
  billingSheet.getColumn('fare').numFmt = '#,##0'
  billingSheet.getColumn('net').numFmt = '#,##0'

  // ==========================================
  // 各廠商明細 Sheet (已移除自然月分頁)
  // ==========================================
  for (const [vendor, trips] of Object.entries(detailTripsByVendor)) {
    const detailSheet = workbook.addWorksheet(vendor)
    detailSheet.columns = [
      { header: '日期', key: 'date', width: 15 },
      { header: '業務類別', key: 'service', width: 15 },
      { header: '地區', key: 'area', width: 15 },
      { header: '店點數', key: 'stops', width: 10 },
      { header: '趟數', key: 'trips', width: 10 },
      { header: '運費', key: 'fare', width: 15 },
      { header: '備註', key: 'notes', width: 30 }
    ]

    detailSheet.columns.forEach(col => { if (col) col.font = DEFAULT_FONT })
    detailSheet.getRow(1).font = { ...DEFAULT_FONT, bold: true }
    detailSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7FA' } }

    let detailBillingFare = 0
    let detailNaturalOnlyFare = 0

    for (const trip of trips) {
      const r = Array.isArray(trip.vendor_rate_rules) ? trip.vendor_rate_rules[0] : trip.vendor_rate_rules
      const fare = Number(trip.final_fare || 0)
      
      const row = detailSheet.addRow({
        date: new Date(trip.departed_at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }),
        service: r?.service_type || '',
        area: trip.destination_area || '',
        stops: trip.actual_stops || '',
        trips: trip.trip_count || 1,
        fare: fare,
        notes: trip.notes || ''
      })

      if (trip.inBilling) {
        detailBillingFare += fare
      } else {
        detailNaturalOnlyFare += fare
        // 非本期車趟填滿淺黃色背景
        row.eachCell(cell => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF2CC' }
          }
        })
      }
    }
    
    const dTotalRow = detailSheet.addRow({
      date: '本期計費總計', service: '', area: '', stops: '', trips: '', fare: detailBillingFare, notes: ''
    })
    dTotalRow.font = { ...DEFAULT_FONT, bold: true, color: { argb: 'FF2E7D32' } } 

    if (detailNaturalOnlyFare > 0) {
      const nTotalRow = detailSheet.addRow({
        date: '非本期(自然月)運費', service: '', area: '', stops: '', trips: '', fare: detailNaturalOnlyFare, notes: '黃底標示'
      })
      nTotalRow.font = { ...DEFAULT_FONT, bold: true, color: { argb: 'FFED6C02' } } 
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
