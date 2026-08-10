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

// 🌟 將資料庫的 UTC Date 轉換為強制台灣日期的 Excel 安全 Date
function getExcelDate(date: Date) {
  const twDateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }) // 取得 'YYYY-MM-DD'
  const [y, m, d] = twDateStr.split('-').map(Number)
  return new Date(y, m - 1, d) // 回傳一個強制以台灣年/月/日為基準的 Date 給 ExcelJS
}

type AggRow = {
  vendor: string
  service: string
  fare: number
  commRate: number
  net: number
}

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

  // 資料暫存結構
  const billingAgg: Record<string, { commRate: number, services: Record<string, number> }> = {}
  
  type TripData = {
    dateObj: Date
    dateStr: string
    serviceType: string
    area: string | null
    stops: number | null
    tripCount: number
    fare: number
    notes: string | null
    inBilling: boolean
  }
  const detailTripsByVendor: Record<string, TripData[]> = {}

  for (const rawTrip of (rawTrips || [])) {
    const trip = rawTrip as any
    const v = Array.isArray(trip.vendors) ? trip.vendors[0] : trip.vendors
    const r = Array.isArray(trip.vendor_rate_rules) ? trip.vendor_rate_rules[0] : trip.vendor_rate_rules
    
    const vendorName = v?.name || '未知廠商'
    const serviceType = r?.service_type || '一般業務'
    const startDay = v?.billing_cycle_start_day ?? 1
    
    if (!trip.departed_at) continue
    const tripDate = new Date(trip.departed_at)
    // 取得當地 YYYY-MM-DD 作為概覽的分組鍵
    const dateStr = tripDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
    const fare = Number(trip.final_fare || 0)
    
    const commRate = trip.vendor_id ? (vendorCommRates[trip.vendor_id] || 0) : 0
    
    const billing = getBillingCycle(targetYear, targetMonth, startDay)
    const inBilling = tripDate >= billing.start && tripDate < billing.end

    const natural = getNaturalMonth(targetYear, targetMonth)
    const inNatural = tripDate >= natural.start && tripDate < natural.end

    if (inBilling || inNatural) {
      if (!detailTripsByVendor[vendorName]) detailTripsByVendor[vendorName] = []
      detailTripsByVendor[vendorName].push({
        dateObj: getExcelDate(tripDate), // 🌟 使用校正後的 Excel 專屬日期
        dateStr: dateStr,
        serviceType: serviceType,
        area: trip.destination_area || null,
        stops: trip.actual_stops || null,
        tripCount: trip.trip_count || 1,
        fare: fare,
        notes: trip.notes || null,
        inBilling: inBilling
      })
    }

    if (inBilling) {
      if (!billingAgg[vendorName]) {
        billingAgg[vendorName] = { commRate: commRate / 100, services: {} }
      }
      if (!billingAgg[vendorName].services[serviceType]) {
        billingAgg[vendorName].services[serviceType] = 0
      }
      billingAgg[vendorName].services[serviceType] += fare
    }
  }

  // 繪製 Excel
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'YuLang ERP'

  // ==========================================
  // Sheet 1: 計費結算總計
  // ==========================================
  const billingSheet = workbook.addWorksheet('計費結算總計')
  
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
  billingSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' }

  let grandBillingNet = 0
  let currentRow = 2

  for (const [vendor, data] of Object.entries(billingAgg)) {
    const startRow = currentRow
    // 將業務按照金額排序
    const services = Object.entries(data.services).sort((a, b) => b[1] - a[1]) 
    
    let vendorTotalFare = 0
    let vendorTotalNet = 0

    // 印出明細行
    services.forEach(([service, fare]) => {
      billingSheet.addRow({
        vendor: vendor,
        service: service,
        commRate: `${(data.commRate * 100).toFixed(0)}%`,
        fare: fare,
        net: '' 
      })
      vendorTotalFare += fare
      currentRow++
    })

    const endRow = currentRow - 1

    if (endRow > startRow) {
      billingSheet.mergeCells(`A${startRow}:A${endRow}`)
      billingSheet.mergeCells(`C${startRow}:C${endRow}`)
    }
    
    billingSheet.getCell(`A${startRow}`).alignment = { vertical: 'middle', horizontal: 'center' }
    billingSheet.getCell(`C${startRow}`).alignment = { vertical: 'middle', horizontal: 'center' }

    vendorTotalNet = vendorTotalFare * (1 - data.commRate)
    const subTotalRow = billingSheet.addRow({
      vendor: '小計',
      service: '',
      commRate: '',
      fare: vendorTotalFare,
      net: vendorTotalNet
    })
    
    billingSheet.mergeCells(`A${currentRow}:C${currentRow}`)
    billingSheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }

    subTotalRow.eachCell(cell => {
      cell.font = { ...DEFAULT_FONT, color: { argb: 'FFD84315' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBE6' } }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } }
    })

    grandBillingNet += vendorTotalNet
    currentRow++
  }

  const btRow = billingSheet.addRow({ vendor: '計費結算總計', service: '', commRate: '', fare: '', net: grandBillingNet })
  billingSheet.mergeCells(`A${currentRow}:D${currentRow}`)
  billingSheet.getCell(`A${currentRow}`).alignment = { horizontal: 'left', vertical: 'middle' }
  
  btRow.eachCell(cell => {
    cell.font = { ...DEFAULT_FONT, bold: true, color: { argb: 'FFD32F2F' } }
  })

  billingSheet.getColumn('fare').numFmt = '#,##0'
  billingSheet.getColumn('net').numFmt = '#,##0'

  // ==========================================
  // 廠商專屬概覽與明細分頁
  // ==========================================
  const sortedVendors = Object.keys(detailTripsByVendor).sort()

  for (const vendor of sortedVendors) {
    const trips = detailTripsByVendor[vendor]
    
    // --- 廠商概覽分頁 ---
    const overviewSheet = workbook.addWorksheet(`${vendor}概覽`)
    const services = Array.from(new Set(trips.map(t => t.serviceType))).sort()
    const isSingleService = services.length === 1
    
    const overviewCols = [{ header: '日期', key: 'date', width: 15 }]
    if (isSingleService) {
      overviewCols.push({ header: '金額', key: 'fare', width: 15 })
    } else {
      services.forEach(s => overviewCols.push({ header: s, key: s, width: 15 }))
      overviewCols.push({ header: '總計', key: 'total', width: 15 })
    }
    overviewSheet.columns = overviewCols
    overviewSheet.columns.forEach(col => { if (col) col.font = DEFAULT_FONT })
    overviewSheet.getRow(1).font = { ...DEFAULT_FONT, bold: true }
    overviewSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }
    overviewSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' }

    const dateMap: Record<string, { dateObj: Date, inBilling: boolean, fares: Record<string, number> }> = {}
    trips.forEach(t => {
      const dStr = t.dateStr
      if (!dateMap[dStr]) dateMap[dStr] = { dateObj: t.dateObj, inBilling: t.inBilling, fares: {} }
      if (!dateMap[dStr].fares[t.serviceType]) dateMap[dStr].fares[t.serviceType] = 0
      dateMap[dStr].fares[t.serviceType] += t.fare
    })
    
    const sortedDates = Object.keys(dateMap).sort()
    
    sortedDates.forEach(dStr => {
      const dInfo = dateMap[dStr]
      const rowData: any = { date: dInfo.dateObj }
      
      let dayTotal = 0
      if (isSingleService) {
        const fare = dInfo.fares[services[0]] || 0
        rowData.fare = fare
      } else {
        services.forEach(s => {
          const fare = dInfo.fares[s] || 0
          rowData[s] = fare > 0 ? fare : null
          dayTotal += fare
        })
        rowData.total = dayTotal
      }
      
      const row = overviewSheet.addRow(rowData)
      if (!dInfo.inBilling) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
        })
      }
    })
    
    if (isSingleService) {
      const totalFare = trips.reduce((sum, t) => sum + t.fare, 0)
      const totRow = overviewSheet.addRow({ date: '合計', fare: totalFare })
      totRow.font = { ...DEFAULT_FONT, bold: true }
      overviewSheet.getCell(`A${overviewSheet.rowCount}`).alignment = { horizontal: 'right' }
    } else {
      const totData: any = { date: '總計' }
      let grandTot = 0
      services.forEach(s => {
        const sTot = trips.filter(t => t.serviceType === s).reduce((sum, t) => sum + t.fare, 0)
        totData[s] = sTot
        grandTot += sTot
      })
      totData.total = grandTot
      const totRow = overviewSheet.addRow(totData)
      totRow.font = { ...DEFAULT_FONT, bold: true }
      overviewSheet.getCell(`A${overviewSheet.rowCount}`).alignment = { horizontal: 'center' }
    }
    
    overviewSheet.getColumn('date').numFmt = 'yyyy/m/d'
    if (isSingleService) {
      overviewSheet.getColumn('fare').numFmt = '#,##0'
    } else {
      services.forEach(s => overviewSheet.getColumn(s).numFmt = '#,##0')
      overviewSheet.getColumn('total').numFmt = '#,##0'
    }

    // --- 廠商明細分頁 ---
    const detailSheet = workbook.addWorksheet(`${vendor}明細`)
    
    const hasArea = trips.some(t => t.area)
    const hasStops = trips.some(t => t.stops)
    
    const detailCols = [
      { header: '日期', key: 'date', width: 15 },
      { header: '業務類別', key: 'service', width: 15 }
    ]
    if (hasArea) detailCols.push({ header: '地區', key: 'area', width: 15 })
    if (hasStops) detailCols.push({ header: '店點數', key: 'stops', width: 10 })
    
    detailCols.push(
      { header: '趟數', key: 'trips', width: 10 },
      { header: '運費', key: 'fare', width: 15 },
      { header: '備註', key: 'notes', width: 30 }
    )
    
    detailSheet.columns = detailCols
    detailSheet.columns.forEach(col => { if (col) col.font = DEFAULT_FONT })
    detailSheet.getRow(1).font = { ...DEFAULT_FONT, bold: true }
    detailSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7FA' } }
    detailSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' }

    let detailTotalFare = 0

    // 依日期排序
    trips.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())

    for (const trip of trips) {
      const rowData: any = {
        date: trip.dateObj,
        service: trip.serviceType,
        trips: trip.tripCount,
        fare: trip.fare,
        notes: trip.notes || ''
      }
      if (hasArea) rowData.area = trip.area || ''
      if (hasStops) rowData.stops = trip.stops || ''

      const row = detailSheet.addRow(rowData)

      if (!trip.inBilling) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
        })
      }
      detailTotalFare += trip.fare
    }
    
    const dTotalRow = detailSheet.addRow({ date: '總計', fare: detailTotalFare })
    dTotalRow.font = { ...DEFAULT_FONT, bold: true, color: { argb: 'FF2E7D32' } } 
    detailSheet.getCell(`A${detailSheet.rowCount}`).alignment = { horizontal: 'right' }
    
    detailSheet.getColumn('date').numFmt = 'yyyy/mm/dd'
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
