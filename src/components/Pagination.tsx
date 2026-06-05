'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react'

export const PAGE_SIZE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '15',  label: '15' },
  { value: '30',  label: '30' },
  { value: '50',  label: '50' },
  { value: '100', label: '100' },
  { value: 'all', label: 'ALL' },
]

/**
 * Resolve `page`/`pageSize` query params for a given total row count.
 * `pageSize` accepts a positive integer string, "all", or any falsey value
 * (defaults to 15). Values are clamped so callers always get a valid window.
 */
export function resolvePageWindow(
  total: number,
  pageRaw?: string,
  sizeRaw?: string,
): {
  pageSizeStr: string         // 'all' or numeric string for UI/links
  effectiveSize: number       // total when 'all', otherwise numeric size
  page: number                // 1-based clamped to [1, totalPages]
  totalPages: number          // >= 1
  startIdx: number            // 0-based slice start
  endIdx: number              // exclusive slice end
} {
  const sizeStr = (sizeRaw ?? '').trim().toLowerCase()
  const isAll = sizeStr === 'all'
  const num = Number(sizeStr)
  const validNum = Number.isFinite(num) && num > 0 ? Math.floor(num) : 15
  const effectiveSize = isAll ? Math.max(total, 1) : validNum
  const totalPages = Math.max(1, Math.ceil(total / effectiveSize))
  const pageNum = Math.max(1, Math.min(totalPages, Math.floor(Number(pageRaw) || 1)))
  const startIdx = (pageNum - 1) * effectiveSize
  const endIdx   = isAll ? total : Math.min(total, startIdx + effectiveSize)
  return {
    pageSizeStr: isAll ? 'all' : String(validNum),
    effectiveSize,
    page: pageNum,
    totalPages,
    startIdx,
    endIdx,
  }
}

interface Props {
  page: number
  totalPages: number
  total: number
  pageSize: string  // 'all' | '15' | '30' | ...
}

export default function Pagination({ page, totalPages, total, pageSize }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  function hrefFor(nextPage: number, nextSize?: string): string {
    const params = new URLSearchParams(searchParams.toString())
    if (nextSize !== undefined) {
      if (nextSize === '15') params.delete('pageSize')
      else                   params.set('pageSize', nextSize)
      params.delete('page')
    } else {
      if (nextPage <= 1) params.delete('page')
      else               params.set('page', String(nextPage))
    }
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const atFirst = page <= 1
  const atLast  = page >= totalPages

  const navStyle: React.CSSProperties = {
    width: 28, height: 28,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid var(--border)', borderRadius: 6,
    background: 'transparent', cursor: 'pointer', color: 'var(--text2)',
  }
  const navDisabledStyle: React.CSSProperties = {
    ...navStyle, cursor: 'not-allowed', opacity: 0.35,
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      padding: '10px 4px', fontSize: 12, color: 'var(--text2)',
    }}>
      <span style={{ color: 'var(--text3)' }}>每頁顯示</span>
      <select
        className="input" style={{ width: 70, height: 28, padding: '2px 6px' }}
        value={pageSize}
        onChange={e => router.push(hrefFor(1, e.target.value))}
      >
        {PAGE_SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={{ color: 'var(--text3)' }}>筆 / 共 {total.toLocaleString()} 筆</span>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <button type="button" title="第一頁" disabled={atFirst}
          style={atFirst ? navDisabledStyle : navStyle}
          onClick={() => router.push(hrefFor(1))}
        ><ChevronFirst size={14} /></button>
        <button type="button" title="上一頁" disabled={atFirst}
          style={atFirst ? navDisabledStyle : navStyle}
          onClick={() => router.push(hrefFor(page - 1))}
        ><ChevronLeft size={14} /></button>
        <span style={{ padding: '0 10px', fontFamily: 'var(--mono)' }}>
          第 {page} 頁 / 共 {totalPages} 頁
        </span>
        <button type="button" title="下一頁" disabled={atLast}
          style={atLast ? navDisabledStyle : navStyle}
          onClick={() => router.push(hrefFor(page + 1))}
        ><ChevronRight size={14} /></button>
        <button type="button" title="最後一頁" disabled={atLast}
          style={atLast ? navDisabledStyle : navStyle}
          onClick={() => router.push(hrefFor(totalPages))}
        ><ChevronLast size={14} /></button>
      </div>
    </div>
  )
}
