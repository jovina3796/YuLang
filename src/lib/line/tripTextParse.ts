// Pure parser for LINE quick-text trip reports.
//
// Input examples (driver freeform, single LINE message):
//   "2號 低鮮 低鮮 冷鏈永和10"     → 3 trips on day 2 of current month
//   "今天 低鮮5"                   → 1 trip today (低鮮, 5 stops)
//   "5/12 冷鏈淡水 冷鏈三重8"      → 2 trips on May 12
//   "4號 休息"                     → rest day
//   "今天 低鮮5 颱風假"            → 1 trip today with surcharge keyword "颱風假" (🌟 新增支援)
//   "14號 冷鏈林口7點 文山5點"     → 2 trips (🌟 支援省略業務繼承，文山自動帶入冷鏈)
//
// Multi-day (single LINE message): segments separated by newline OR ; OR ；
//   "2號 低鮮 冷鏈永和10\n3號 低鮮5"
//   "2號 低鮮；3號 休息；5/12 冷鏈淡水"
//
// Format (per segment):
//   <date-token> <trip-token>+ <surcharge-keyword>*
//   OR
//   <date-token> 休息
//
// Date tokens (TW timezone):
//   今天 / 今日            → today
//   昨天 / 昨日            → yesterday
//   N號                    → day N of current month
//   M月N號 / M月N日        → month M day N of current year
//   M/N                    → same as 月日
//
// Trip tokens: <service><area?><stops?>
//   service = longest-prefix match against the supplied service-type list
//   area    = optional non-digit text suffix (delivery area, e.g. 永和)
//   stops   = optional trailing digits (delivery point count)

export type TwDate = { year: number; month: number; day: number }

export type ParsedTrip = {
  service: string
  area:    string | null   // raw delivery area as typed by the driver
  stops:   number | null
}

export type ParsedDay =
  | { kind: 'rest'; date: TwDate }
  // 🌟 新增 surcharges 陣列，用來存放這一天觸發的所有特殊加成關鍵字
  | { kind: 'trips'; date: TwDate; trips: ParsedTrip[]; surcharges: string[] } 

export type ParseResult =
  | { kind: 'days'; days: ParsedDay[] }
  | { kind: 'error'; message: string }

const REST_TOKENS = new Set(['休', '休息', '休假'])
const SEGMENT_SEP_RE = /[\r\n;；]+/

function nowTW(): Date {
  return new Date(Date.now() + 8 * 60 * 60 * 1000)
}

function isLeap(y: number): boolean { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 }
function daysInMonth(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
}

function parseDateToken(tok: string): TwDate | null {
  const now = nowTW()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() + 1
  const d = now.getUTCDate()

  if (tok === '今天' || tok === '今日') return { year: y, month: m, day: d }
  if (tok === '昨天' || tok === '昨日') {
    const t = new Date(now.getTime() - 86400000)
    return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() }
  }

  let mm = tok.match(/^(\d{1,2})號$/)
  if (mm) {
    const day = Number(mm[1])
    if (day < 1 || day > daysInMonth(y, m)) return null
    return { year: y, month: m, day }
  }
  mm = tok.match(/^(\d{1,2})月(\d{1,2})[號日]?$/)
  if (mm) {
    const month = Number(mm[1]); const day = Number(mm[2])
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(y, month)) return null
    return { year: y, month, day }
  }
  mm = tok.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (mm) {
    const month = Number(mm[1]); const day = Number(mm[2])
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(y, month)) return null
    return { year: y, month, day }
  }
  return null
}

// 1. 🌟 修改 parseTripToken，讓它自動忽略結尾的「點、件、箱、趟、車」
function parseTripToken(tok: string, services: string[]): ParsedTrip | { error: string } {
  const sorted = [...services].sort((a, b) => b.length - a.length)
  let svc: string | null = null
  for (const s of sorted) {
    if (s && tok.startsWith(s)) { svc = s; break }
  }
  if (!svc) return { error: `無法辨識業務「${tok}」` }
  const rest = tok.slice(svc.length)
  if (rest === '') return { service: svc, area: null, stops: null }
  
  // 🌟 寬容正則：支援非數字區域 + 數字 + 可選單位
  const mm = rest.match(/^([^\d\s]*?)(\d+)?(?:點|件|箱|趟|車)?$/)
  if (!mm || (mm[1] === '' && mm[2] == null)) {
    return { error: `「${tok}」格式不正確（應為 業務 或 業務+區域+數字）` }
  }
  return {
    service: svc,
    area:    mm[1] || null,
    stops:   mm[2] ? Number(mm[2]) : null,
  }
}

export function parseTripText(text: string, services: string[], validSurcharges: string[] = []): ParseResult {
  const segments = text.split(SEGMENT_SEP_RE).map(s => s.trim()).filter(Boolean)
  if (segments.length === 0) {
    return { kind: 'error', message: '訊息為空' }
  }

  const days: ParsedDay[] = []
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const tokens = seg.split(/\s+/).filter(Boolean)
    const prefix = segments.length > 1 ? `第 ${i + 1} 段「${seg}」：` : ''
    if (tokens.length < 2) {
      return { kind: 'error', message: `${prefix}訊息過短，需要：日期 + 至少一筆車趟（或「休息」）` }
    }
    let date = parseDateToken(tokens[0])
    let rest: string[]

    if (date) {
      // 情況 A：有明確輸入日期 (例：今天 低鮮5) -> 切掉第一個字，留下車趟
      rest = tokens.slice(1)
    } else {
      // 情況 B：沒有輸入日期 (例：低鮮5) -> 強制預設為「今天」，且所有文字都是車趟
      date = parseDateToken('今天')!
      rest = tokens
    }
    
    if (rest.some(t => REST_TOKENS.has(t))) {
      if (rest.length !== 1) {
        return { kind: 'error', message: `${prefix}「休息」需單獨出現，無法與車趟混用` }
      }
      days.push({ kind: 'rest', date })
      continue
    }
    
    const trips: ParsedTrip[] = []
    const surcharges: string[] = [] // 🌟 用來收集當天解析出的加成關鍵字

    // 🌟 關鍵新增：記憶前一趟成功的業務名稱（例如 '冷鏈'）
    let lastService: string | null = null

    for (const t of rest) {
      // 🌟 先檢查這個單字是不是加成關鍵字？如果是，就放進 surcharges 陣列，不當作車趟處理
      if (validSurcharges.includes(t)) {
        surcharges.push(t)
        continue
      }

      // 嘗試進行一般車趟解析
      let p = parseTripToken(t, services)

      // 🌟 魔法核心：如果這趟解析失敗（例如「文山5點」因為前面沒有寫「冷鏈」而認不得）
      // 且我們前面有記錄到成功的業務名稱（如「冷鏈」）
      // 那我們就自動幫他把业务跟當前的文字拼在一起（變成「冷鏈文山5點」）重新嘗試解析！
      if ('error' in p && lastService) {
        const retryP = parseTripToken(lastService + t, services)
        if (!('error' in retryP)) {
          p = retryP
        }
      }

      if ('error' in p) return { kind: 'error', message: `${prefix}${p.error}` }
      
      // 🌟 成功解析後，更新最後一次成功的業務名稱，供後續省略業務時繼承使用
      lastService = p.service
      trips.push(p)
    }

    // 🌟 防呆：如果司機只打了「今天 颱風假」卻沒寫車趟，也要報錯
    if (trips.length === 0) {
      return { kind: 'error', message: `${prefix}只有加成關鍵字，沒有填寫實際車趟` }
    }

    days.push({ kind: 'trips', date, trips, surcharges })
  }

  return { kind: 'days', days }
}

// Helpers exposed for the orchestration layer.
export function twDateToIso(d: TwDate): string {
  const m = String(d.month).padStart(2, '0')
  const day = String(d.day).padStart(2, '0')
  return new Date(`${d.year}-${m}-${day}T00:00:00+08:00`).toISOString()
}

export function twDateToYmd(d: TwDate): string {
  const m = String(d.month).padStart(2, '0')
  const day = String(d.day).padStart(2, '0')
  return `${d.year}-${m}-${day}`
}
