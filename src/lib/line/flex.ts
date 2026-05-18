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
