// Shared CSV helpers used by export routes and import server actions.

/** Escape a field for CSV output (adds quotes/escapes if needed). */
export function csvField(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Build a UTF-8 CSV body (with BOM) from header + row arrays. */
export function buildCsv(headers: string[], rows: unknown[][]): string {
  const head = headers.join(',')
  const body = rows.map(r => r.map(csvField).join(',')).join('\r\n')
  return '﻿' + head + '\r\n' + body + (rows.length ? '\r\n' : '')
}

/** Parse CSV text (handles quoted fields, "" escape, CRLF). */
export function parseCsv(text: string): string[][] {
  const stripped = text.replace(/^﻿/, '')
  const out: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < stripped.length) {
    const c = stripped[i]
    if (inQuotes) {
      if (c === '"') {
        if (stripped[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += c; i++
    } else {
      if (c === '"') { inQuotes = true; i++; continue }
      if (c === ',') { cur.push(field); field = ''; i++; continue }
      if (c === '\r') { i++; continue }
      if (c === '\n') { cur.push(field); out.push(cur); cur = []; field = ''; i++; continue }
      field += c; i++
    }
  }
  if (field !== '' || cur.length > 0) { cur.push(field); out.push(cur) }
  return out.filter(r => r.some(c => c.trim() !== ''))
}

/** Format ISO/Date to YYYY-MM-DD (local). */
export function ymd(d: string | Date | null | undefined): string {
  if (!d) return ''
  const dt = d instanceof Date ? d : new Date(d)
  if (isNaN(dt.getTime())) return ''
  return dt.toISOString().slice(0, 10)
}
