// Pure parser for LINE quick-text trip reports.
//
// Input examples (driver freeform, single LINE message):
//   "2號 低鮮 低鮮 冷鏈永和10"     → 3 trips on day 2 of current month
//   "今天 低鮮5"                    → 1 trip today (低鮮, 5 stops)
//   "5/12 冷鏈淡水 冷鏈三重8"      → 2 trips on May 12
//   "4號 休息"                      → rest day
//
// Format:
//   <date-token> <trip-token>+
//   OR
//   <date-token> 休息
//
// Date tokens (TW timezone):
//   今天 / 今日           → today
//   昨天 / 昨日           → yesterday
//   N號                   → day N of current month
//   M月N號 / M月N日       → month M day N of current year
//   M/N                   → same as 月日
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

export type ParseResult =
  | { kind: 'rest'; date: TwDate }
  | { kind: 'trips'; date: TwDate; trips: ParsedTrip[] }
  | { kind: 'error'; message: string }

const REST_TOKENS = new Set(['休', '休息', '休假'])

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

function parseTripToken(tok: string, services: string[]): ParsedTrip | { error: string } {
  // Longest-prefix match against the known service list.
  const sorted = [...services].sort((a, b) => b.length - a.length)
  let svc: string | null = null
  for (const s of sorted) {
    if (s && tok.startsWith(s)) { svc = s; break }
  }
  if (!svc) return { error: `無法辨識業務「${tok}」` }
  const rest = tok.slice(svc.length)
  if (rest === '') return { service: svc, area: null, stops: null }
  // rest must be: <text?><digits?>$  with at least one of them non-empty
  const mm = rest.match(/^([^\d\s]*)(\d+)?$/)
  if (!mm || (mm[1] === '' && mm[2] == null)) {
    return { error: `「${tok}」格式不正確（應為 業務 或 業務+配送區域+數字）` }
  }
  return {
    service: svc,
    area:    mm[1] || null,
    stops:   mm[2] ? Number(mm[2]) : null,
  }
}

export function parseTripText(text: string, services: string[]): ParseResult {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  if (tokens.length < 2) {
    return { kind: 'error', message: '訊息過短，需要：日期 + 至少一筆車趟（或「休息」）' }
  }
  const date = parseDateToken(tokens[0])
  if (!date) {
    return { kind: 'error', message: `日期格式錯誤：「${tokens[0]}」（可用 今天 / N號 / M月N日 / M/N）` }
  }
  const rest = tokens.slice(1)
  if (rest.some(t => REST_TOKENS.has(t))) {
    if (rest.length !== 1) {
      return { kind: 'error', message: '「休息」需單獨出現，無法與車趟混用' }
    }
    return { kind: 'rest', date }
  }
  const trips: ParsedTrip[] = []
  for (const t of rest) {
    const p = parseTripToken(t, services)
    if ('error' in p) return { kind: 'error', message: p.error }
    trips.push(p)
  }
  return { kind: 'trips', date, trips }
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
