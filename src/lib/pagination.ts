/**
 * Pure helpers for page-size / pagination resolution.
 *
 * Kept in a separate (non-'use client') module so that Server Components
 * can import them directly. Re-exported by Pagination.tsx for convenience.
 */

export const PAGE_SIZE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '10',  label: '10' },
  { value: '20',  label: '20' },
  { value: '30',  label: '30' },
  { value: '50',  label: '50' },
  { value: '100', label: '100' },
  { value: 'all', label: 'ALL' },
]

/**
 * Resolve `page`/`pageSize` query params for a given total row count.
 * `pageSize` accepts a positive integer string, "all", or any falsey value
 * (defaults to 10). Values are clamped so callers always get a valid window.
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
  const validNum = Number.isFinite(num) && num > 0 ? Math.floor(num) : 10
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
