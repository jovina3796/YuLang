import type { FlexBubble, FlexComponent } from '@/lib/line/api'

const GREEN = '#2E7D32'
const MUTED = '#888888'
const BORDER = '#E0E0E0'

function row(label: string, value: string): FlexComponent {
  return {
    type: 'box',
    layout: 'baseline',
    contents: [
      { type: 'text', text: label, color: MUTED, size: 'sm', flex: 2 },
      { type: 'text', text: value, size: 'sm', flex: 5, wrap: true, color: '#222222' },
    ],
  }
}

export type FuelSummary = {
  date:    string
  plate:   string
  mileage?: number | null
  total:   number
  payment?: string | null
}

export function fuelSuccessBubble(s: FuelSummary, opts?: { detailed?: boolean }): FlexBubble {
  const detailed = opts?.detailed ?? false
  const rows: FlexComponent[] = []
  if (detailed) {
    rows.push(row('日期', s.date))
    rows.push(row('車輛', s.plate))
    if (s.mileage != null) rows.push(row('里程', `${s.mileage} km`))
    rows.push(row('金額', `NT$ ${s.total.toLocaleString()}`))
    if (s.payment) rows.push(row('付款', s.payment))
  }

  const bodyContents: FlexComponent[] = [
    { type: 'text', text: '加油資料已記錄 ✓', weight: 'bold', size: 'lg', color: GREEN, align: 'center' },
  ]
  if (rows.length > 0) {
    bodyContents.push({ type: 'separator', margin: 'md', color: BORDER })
    bodyContents.push({ type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm', contents: rows })
  }

  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      contents: bodyContents,
    },
  }
}

export type TripSummary = {
  date:        string
  vendor:      string
  area?:       string | null
  service?:    string | null
  trip_count:  number
  stops?:      number | null
  fare?:       number | null
  is_kpi?:     boolean | null
  is_special?: boolean | null
}

export function tripSuccessBubble(s: TripSummary): FlexBubble {
  const rows: FlexComponent[] = []
  rows.push(row('日期', s.date))
  rows.push(row('廠商', s.vendor))
  if (s.area)    rows.push(row('區域', s.area))
  if (s.service) rows.push(row('車型', s.service))
  rows.push(row('趟數', String(s.trip_count)))
  if (s.stops != null) rows.push(row('站數', String(s.stops)))
  if (s.fare != null)  rows.push(row('運費', `NT$ ${s.fare.toLocaleString()}`))
  const flags: string[] = []
  if (s.is_kpi)     flags.push('達標')
  if (s.is_special) flags.push('加成')
  if (flags.length) rows.push(row('標記', flags.join(' / ')))

  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: '車趟資料已記錄 ✓', weight: 'bold', size: 'lg', color: GREEN, align: 'center' },
        { type: 'separator', margin: 'md', color: BORDER },
        { type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm', contents: rows },
      ],
    },
  }
}

export type TripLine = {
  vendor:  string
  service: string
  area?:   string | null
  stops?:  number | null
  fare:    number
}

export function tripsSuccessBubble(date: string, lines: TripLine[]): FlexBubble {
  const itemRows: FlexComponent[] = []
  let total = 0
  lines.forEach((t, i) => {
    const head = `${i + 1}. ${t.vendor}`.trim()
    const detailParts: string[] = [t.service]
    if (t.area) detailParts.push(t.area)
    if (t.stops != null) detailParts.push(`${t.stops}點`)
    const detail = detailParts.join(' · ')
    itemRows.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          flex: 5,
          contents: [
            { type: 'text', text: head, size: 'sm', weight: 'bold', color: '#222222', wrap: true },
            { type: 'text', text: detail, size: 'xs', color: MUTED, wrap: true },
          ],
        },
        { type: 'text', text: `NT$ ${t.fare.toLocaleString()}`, size: 'sm', color: GREEN, align: 'end', flex: 3 },
      ],
    })
    total += t.fare
  })

  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: `車趟已記錄 ✓ ${lines.length} 筆`, weight: 'bold', size: 'lg', color: GREEN, align: 'center' },
        { type: 'text', text: date, size: 'sm', color: MUTED, align: 'center', margin: 'sm' },
        { type: 'separator', margin: 'md', color: BORDER },
        { type: 'box', layout: 'vertical', margin: 'md', spacing: 'md', contents: itemRows },
        { type: 'separator', margin: 'md', color: BORDER },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            { type: 'text', text: '合計', size: 'sm', weight: 'bold', color: '#222222', flex: 2 },
            { type: 'text', text: `NT$ ${total.toLocaleString()}`, size: 'md', weight: 'bold', color: GREEN, align: 'end', flex: 5 },
          ],
        },
      ],
    },
  }
}

export function restDayBubble(date: string, driverName: string): FlexBubble {
  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: '休假已登記 ✓', weight: 'bold', size: 'lg', color: GREEN, align: 'center' },
        { type: 'separator', margin: 'md', color: BORDER },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'md',
          spacing: 'sm',
          contents: [
            row('司機', driverName),
            row('日期', date),
          ],
        },
      ],
    },
  }
}

export type TripDayGroup =
  | { kind: 'trips'; date: string; lines: TripLine[] }
  | { kind: 'rest';  date: string }

export function tripsMultiDayBubble(driverNote: string, groups: TripDayGroup[]): FlexBubble {
  const blocks: FlexComponent[] = []
  let grandTotal = 0
  let tripCount = 0
  let restCount = 0

  groups.forEach((g, gi) => {
    if (gi > 0) blocks.push({ type: 'separator', margin: 'md', color: BORDER })
    if (g.kind === 'rest') {
      restCount += 1
      blocks.push({
        type: 'box',
        layout: 'horizontal',
        margin: 'md',
        contents: [
          { type: 'text', text: g.date, size: 'sm', weight: 'bold', color: '#222222', flex: 4 },
          { type: 'text', text: '休假', size: 'sm', color: GREEN, align: 'end', flex: 3 },
        ],
      })
      return
    }
    let daySubtotal = 0
    const dayItems: FlexComponent[] = []
    g.lines.forEach((t, i) => {
      const head = `${i + 1}. ${t.vendor}`.trim()
      const detailParts: string[] = [t.service]
      if (t.area) detailParts.push(t.area)
      if (t.stops != null) detailParts.push(`${t.stops}點`)
      const detail = detailParts.join(' · ')
      dayItems.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            flex: 5,
            contents: [
              { type: 'text', text: head, size: 'sm', weight: 'bold', color: '#222222', wrap: true },
              { type: 'text', text: detail, size: 'xs', color: MUTED, wrap: true },
            ],
          },
          { type: 'text', text: `NT$ ${t.fare.toLocaleString()}`, size: 'sm', color: GREEN, align: 'end', flex: 3 },
        ],
      })
      daySubtotal += t.fare
      tripCount += 1
    })
    grandTotal += daySubtotal
    blocks.push({
      type: 'box',
      layout: 'horizontal',
      margin: 'md',
      contents: [
        { type: 'text', text: g.date, size: 'sm', weight: 'bold', color: '#222222', flex: 4 },
        { type: 'text', text: `${g.lines.length} 筆 · NT$ ${daySubtotal.toLocaleString()}`, size: 'xs', color: MUTED, align: 'end', flex: 5 },
      ],
    })
    blocks.push({ type: 'box', layout: 'vertical', margin: 'sm', spacing: 'md', contents: dayItems })
  })

  const headerParts: string[] = []
  if (tripCount > 0) headerParts.push(`${tripCount} 筆車趟`)
  if (restCount > 0) headerParts.push(`${restCount} 日休假`)
  const headerText = `已記錄 ✓ ${headerParts.join(' · ')}`

  const body: FlexComponent[] = [
    { type: 'text', text: headerText, weight: 'bold', size: 'lg', color: GREEN, align: 'center' },
  ]
  if (driverNote) {
    body.push({ type: 'text', text: driverNote, size: 'xs', color: MUTED, align: 'center', margin: 'sm' })
  }
  body.push({ type: 'separator', margin: 'md', color: BORDER })
  body.push(...blocks)
  if (grandTotal > 0) {
    body.push({ type: 'separator', margin: 'md', color: BORDER })
    body.push({
      type: 'box',
      layout: 'horizontal',
      margin: 'md',
      contents: [
        { type: 'text', text: '總計', size: 'sm', weight: 'bold', color: '#222222', flex: 2 },
        { type: 'text', text: `NT$ ${grandTotal.toLocaleString()}`, size: 'md', weight: 'bold', color: GREEN, align: 'end', flex: 5 },
      ],
    })
  }

  return {
    type: 'bubble',
    size: 'kilo',
    body: { type: 'box', layout: 'vertical', paddingAll: '20px', contents: body },
  }
}

export function tripParseErrorBubble(originalText: string, reason: string, liffUrl: string | null): FlexBubble {
  const contents: FlexComponent[] = [
    { type: 'text', text: '車趟回報解析失敗', weight: 'bold', size: 'md', color: '#C62828', align: 'center' },
    { type: 'separator', margin: 'md', color: BORDER },
    { type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm', contents: [
      row('原因', reason),
      row('原文', `「${originalText}」`),
    ] },
  ]
  if (liffUrl) {
    contents.push({ type: 'text', text: '可改用 LIFF 表單回報：', size: 'xs', color: MUTED, margin: 'md' })
  }
  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      contents,
    },
  }
  if (liffUrl) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: GREEN,
          height: 'md',
          action: { type: 'uri', label: '開啟車趟表單', uri: liffUrl },
        },
      ],
    }
  }
  return bubble
}

export type MaintenanceSummary = {
  date:        string
  plate:       string
  type:        string
  vendor?:     string | null
  cost?:       number | null
  mileage?:    number | null
  next_due?:   string | null
}

export function maintenanceSuccessBubble(s: MaintenanceSummary): FlexBubble {
  const rows: FlexComponent[] = []
  rows.push(row('日期', s.date))
  rows.push(row('車輛', s.plate))
  rows.push(row('項目', s.type))
  if (s.vendor)         rows.push(row('廠商', s.vendor))
  if (s.cost != null)   rows.push(row('金額', `NT$ ${s.cost.toLocaleString()}`))
  if (s.mileage != null)rows.push(row('里程', `${s.mileage} km`))
  if (s.next_due)       rows.push(row('下次', s.next_due))

  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: '維修保養已記錄 ✓', weight: 'bold', size: 'lg', color: GREEN, align: 'center' },
        { type: 'separator', margin: 'md', color: BORDER },
        { type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm', contents: rows },
      ],
    },
  }
}

export function maintenanceFormTriggerBubble(liffUrl: string): FlexBubble {
  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      spacing: 'md',
      contents: [
        { type: 'text', text: '維修保養回報', weight: 'bold', size: 'lg', color: '#222222' },
        { type: 'text', text: '上傳維修單照片或 PDF，AI 會自動辨識項目、金額、廠商等資訊。', size: 'sm', color: MUTED, wrap: true },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: GREEN,
          height: 'md',
          action: { type: 'uri', label: '填寫維修表單', uri: liffUrl },
        },
      ],
    },
  }
}

export type ServiceSummaryLine = {
  service: string
  trips:   number
}

export function tripsMonthlyQueryBubble(opts: {
  driverName:   string
  rangeLabel:   string   // 例：2026-05 / 2026-04 / 近 7 天
  totalTrips:   number
  totalFare:    number
  restDays:     number
  byService:    ServiceSummaryLine[]
  driverNote?:  string   // 例：代查
}): FlexBubble {
  const { driverName, rangeLabel, totalTrips, totalFare, restDays, byService, driverNote } = opts

  const itemRows: FlexComponent[] = byService.map(s => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: s.service, size: 'sm', color: '#222222', flex: 5, wrap: true },
      { type: 'text', text: `${s.trips} 趟`, size: 'sm', color: GREEN, align: 'end', flex: 3 },
    ],
  }))

  const body: FlexComponent[] = [
    { type: 'text', text: `${driverName} ・ ${rangeLabel}`, weight: 'bold', size: 'lg', color: '#222222', align: 'center' },
  ]
  if (driverNote) {
    body.push({ type: 'text', text: driverNote, size: 'xs', color: MUTED, align: 'center', margin: 'sm' })
  }
  body.push({ type: 'separator', margin: 'md', color: BORDER })

  if (itemRows.length === 0) {
    body.push({ type: 'text', text: '此區間無車趟紀錄', size: 'sm', color: MUTED, align: 'center', margin: 'md' })
  } else {
    body.push({ type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm', contents: itemRows })
  }

  body.push({ type: 'separator', margin: 'md', color: BORDER })
  body.push({
    type: 'box',
    layout: 'horizontal',
    margin: 'md',
    contents: [
      { type: 'text', text: '總趟數', size: 'sm', color: MUTED, flex: 2 },
      { type: 'text', text: `${totalTrips} 趟`, size: 'sm', color: '#222222', align: 'end', flex: 5 },
    ],
  })
  if (restDays > 0) {
    body.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: '休假', size: 'sm', color: MUTED, flex: 2 },
        { type: 'text', text: `${restDays} 日`, size: 'sm', color: '#222222', align: 'end', flex: 5 },
      ],
    })
  }
  body.push({
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      { type: 'text', text: '運費結算', size: 'sm', weight: 'bold', color: '#222222', flex: 2 },
      { type: 'text', text: `NT$ ${totalFare.toLocaleString()}`, size: 'md', weight: 'bold', color: GREEN, align: 'end', flex: 5 },
    ],
  })
  body.push({ type: 'text', text: '※ 尚未扣除上游抽成', size: 'xs', color: MUTED, align: 'end', margin: 'sm' })

  return {
    type: 'bubble',
    size: 'kilo',
    body: { type: 'box', layout: 'vertical', paddingAll: '20px', contents: body },
  }
}

export type FuelGroupLine = {
  label: string
  count: number
  total: number
}

export function fuelMonthlyQueryBubble(opts: {
  headerLabel: string  // 例：KPD-1681
  rangeLabel:  string
  totalCount:  number
  totalAmount: number
  byPayment:   FuelGroupLine[]
  note?:       string  // optional caption shown under header (e.g. 代查)
}): FlexBubble {
  const { headerLabel, rangeLabel, totalCount, totalAmount, byPayment, note } = opts

  const itemRows: FlexComponent[] = byPayment.map(l => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: l.label, size: 'sm', color: '#222222', flex: 4, wrap: true },
      { type: 'text', text: `${l.count} 次`, size: 'sm', color: MUTED, align: 'end', flex: 2 },
      { type: 'text', text: `$ ${l.total.toLocaleString()}`, size: 'sm', color: GREEN, align: 'end', flex: 4 },
    ],
  }))

  const body: FlexComponent[] = [
    { type: 'text', text: `${headerLabel} ・ ${rangeLabel}`, weight: 'bold', size: 'lg', color: '#222222', align: 'center' },
    { type: 'text', text: '加油查詢', size: 'xs', color: MUTED, align: 'center', margin: 'sm' },
  ]
  if (note) {
    body.push({ type: 'text', text: note, size: 'xs', color: MUTED, align: 'center' })
  }
  body.push({ type: 'separator', margin: 'md', color: BORDER })

  if (totalCount === 0) {
    body.push({ type: 'text', text: '此區間無加油紀錄', size: 'sm', color: MUTED, align: 'center', margin: 'md' })
  } else {
    body.push({ type: 'text', text: '付款方式', size: 'xs', color: MUTED, margin: 'md' })
    body.push({ type: 'box', layout: 'vertical', margin: 'sm', spacing: 'sm', contents: itemRows })
  }

  body.push({ type: 'separator', margin: 'md', color: BORDER })
  body.push({
    type: 'box',
    layout: 'horizontal',
    margin: 'md',
    contents: [
      { type: 'text', text: '加油次數', size: 'sm', color: MUTED, flex: 2 },
      { type: 'text', text: `${totalCount} 次`, size: 'sm', color: '#222222', align: 'end', flex: 5 },
    ],
  })
  body.push({
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      { type: 'text', text: '油資結算', size: 'sm', weight: 'bold', color: '#222222', flex: 2 },
      { type: 'text', text: `$ ${totalAmount.toLocaleString()}`, size: 'md', weight: 'bold', color: GREEN, align: 'end', flex: 5 },
    ],
  })

  return {
    type: 'bubble',
    size: 'kilo',
    body: { type: 'box', layout: 'vertical', paddingAll: '20px', contents: body },
  }
}

export function tripFormTriggerBubble(liffUrl: string): FlexBubble {
  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      spacing: 'md',
      contents: [
        { type: 'text', text: '車趟回報', weight: 'bold', size: 'lg', color: '#222222' },
        { type: 'text', text: '點擊下方按鈕填寫車趟表單。', size: 'sm', color: MUTED, wrap: true },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: GREEN,
          height: 'md',
          action: { type: 'uri', label: '填寫車趟表單', uri: liffUrl },
        },
      ],
    },
  }
}

// Bubble shown when the driver just types「加油」and a LIFF form is configured.
// Renders a "填寫" button that opens the LIFF URL inside LINE.
export function fuelFormTriggerBubble(liffUrl: string): FlexBubble {
  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      spacing: 'md',
      contents: [
        { type: 'text', text: '加油回報', weight: 'bold', size: 'lg', color: '#222222' },
        { type: 'text', text: '點擊下方按鈕，填寫表單後送出。', size: 'sm', color: MUTED, wrap: true },
        { type: 'separator', margin: 'md', color: BORDER },
        { type: 'text', text: '亦可直接輸入快速指令：', size: 'xs', color: MUTED, margin: 'md' },
        { type: 'text', text: '加油 [里程] [付款] [金額] [日期(選填)]', size: 'xs', color: '#444444', wrap: true },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: GREEN,
          height: 'md',
          action: { type: 'uri', label: '填寫加油表單', uri: liffUrl },
        },
      ],
    },
  }
}
