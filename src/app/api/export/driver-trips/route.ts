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

    if (inBilling || inNatural) {
      if (!detailTripsByVendor[vendorName]) detailTripsByVendor[vendorName] = []
      detailTripsByVendor[vendorName].push({ ...trip, inBilling })
    }

    if (inBilling) {
      if (!billingAgg[aggKey]) billingAgg[aggKey] = { vendor: vendorName, service: serviceType, fare: 0, commRate, net: 0 }
      billingAgg[aggKey].fare += fare
      billingAgg[aggKey].net += net
    }
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'YuLang ERP'

  // ==========================================
  // Sheet 1: 計費結算總計 (發薪依據)
  // ==========================================
  const billingSheet = workbook.addWorksheet('計費結算總計')
  
  // 🌟 更新欄位順序對齊圖片需求
  billingSheet.columns = [
    { header: '廠商', key: 'vendor', width: 15 },
    { header: '業務', key: 'service', width: 15 },
    { header: '上游抽成比例', key: 'commRate', width: 15 },
    { header: '運費金額', key: 'fare', width: 15 },
    { header: '實領金額', key: 'net', width: 15 }
  ]
  
  billingSheet.columns.forEach(col => { if (col) col.font = DEFAULT_FONT })
  billingSheet.getRow(1).font = { ...DEFAULT_FONT, bold: true }
  billingSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }

  const groupedBilling = Object.values(billingAgg).reduce((acc, row) => {
    if (!acc[row.vendor]) acc[row.vendor] = []
    acc[row.vendor].push(row)
    return acc
  }, {} as Record<string, AggRow[]>)

  let grandBillingNet = 0

  // 🌟 動態輸出資料並合併儲存格
  for (const [vendor, rows] of Object.entries(groupedBilling)) {
    const startRow = billingSheet.rowCount + 1
    let vendorTotalFare = 0
    let vendorTotalNet = 0

    rows.forEach(row => {
      billingSheet.addRow({
        vendor: row.vendor,
        service: row.service,
        commRate: `${row.commRate.toFixed(0)}%`,
        fare: row.fare,
        net: '' // 🌟 明細列的實領金額保持空白
      })
      vendorTotalFare += row.fare
      vendorTotalNet += row.net
    })

    const endRow = billingSheet.rowCount

    // 🌟 合併 A 欄(廠商) 與 C 欄(抽成比例)
    if (endRow > startRow) {
      billingSheet.mergeCells(`A${startRow}:A${endRow}`)
      billingSheet.mergeCells(`C${startRow}:C${endRow}`)
    }
    
    // 垂直與水平置中
    billingSheet.getCell(`A${startRow}`).alignment = { vertical: 'middle', horizontal: 'center' }
    billingSheet.getCell(`C${startRow}`).alignment = { vertical: 'middle', horizontal: 'center' }

    // 🌟 加入小計列
    const subTotalRow = billingSheet.addRow({
      vendor: '小計', // 將會合併 A~C
      service: '',
      commRate: '',
      fare: vendorTotalFare,
      net: vendorTotalNet
    })
    
    const subRowNum = billingSheet.rowCount
    billingSheet.mergeCells(`A${subRowNum}:C${subRowNum}`)
    billingSheet.getCell(`A${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' }

    // 🌟 小計列專屬樣式 (橘色文字、淺橘底色、下底線)
    subTotalRow.eachCell(cell => {
      cell.font = { ...DEFAULT_FONT, color: { argb: 'FFD84315' } } // 橘紅色文字
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBE6' } } // 淺橘色背景
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } } // 黑色下底線
    })

    grandBillingNet += vendorTotalNet
  }

  // 🌟 最下方的總計列
  const btRow = billingSheet.addRow({ vendor: '計費結算總計', service: '', commRate: '', fare: '', net: grandBillingNet })
  const btRowNum = billingSheet.rowCount
  billingSheet.mergeCells(`A${btRowNum}:D${btRowNum}`) // 合併 A~D
  billingSheet.getCell(`A${btRowNum}`).alignment = { horizontal: 'left', vertical: 'middle' }
  
  btRow.eachCell(cell => {
    cell.font = { ...DEFAULT_FONT, bold: true, color: { argb: 'FFD32F2F' } } // 紅色粗體
  })

  billingSheet.getColumn('fare').numFmt = '#,##0'
  billingSheet.getColumn('net').numFmt = '#,##0'

  // ==========================================
  // 各廠商明細 Sheet
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
