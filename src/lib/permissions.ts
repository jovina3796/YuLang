import type { Role } from '@/lib/auth'

// Every nav route the app exposes. Order matches Sidebar groups so admin
// checkbox UI reads top-to-bottom in the same order as the sidebar.
export const NAV_HREFS = [
  '/dashboard',
  '/trips',
  '/vehicles',
  '/people',
  '/schedule',
  '/fuel',
  '/maintenance',
  '/inspection',
  '/reports',
  '/finance',
  '/payroll',
  '/vendor-info',
  '/claims',
  '/leaves',
  '/overtimes',
  '/settings',
] as const
export type NavHref = (typeof NAV_HREFS)[number]

export const NAV_LABELS: Record<NavHref, string> = {
  '/dashboard':    '儀表板',
  '/trips':        '車趟紀錄',
  '/vehicles':     '車輛列表',
  '/people':       '人員管理',
  '/schedule':     '排班設定',
  '/fuel':         '加油紀錄',
  '/maintenance':  '保養維修',
  '/inspection':   '驗車紀錄',
  '/reports':      '統計報表',
  '/finance':      '收支報表',
  '/payroll':      '薪資單據',
  '/vendor-info':  '廠商資訊',
  '/claims':       '請款簽核',
  '/leaves':       '請假簽核',
  '/overtimes':    '加班簽核',
  '/settings':     '系統設定',
}

// Default page set per role. Used both as the upper bound for an admin's
// per-user checkbox UI and as the fallback when allowed_pages is null.
export const ROLE_DEFAULTS: Record<Role, readonly NavHref[]> = {
  admin:  NAV_HREFS,
  driver: ['/dashboard', '/payroll', '/claims', '/leaves', '/overtimes'],
}

/**
 * Resolve the effective allow-set for a profile.
 * - allowed_pages null → role default
 * - allowed_pages non-null → intersection with role default (defence-in-depth)
 */
export function resolveAllowedPages(p: {
  role: Role
  allowed_pages: string[] | null
}): Set<NavHref> {
  const roleSet = new Set(ROLE_DEFAULTS[p.role])
  if (!p.allowed_pages) return roleSet
  const out = new Set<NavHref>()
  for (const h of p.allowed_pages) {
    if (roleSet.has(h as NavHref)) out.add(h as NavHref)
  }
  return out
}

/** Pathname permission check: a request to /foo/bar is allowed iff /foo is in the allow-set. */
export function canAccess(
  p: { role: Role; allowed_pages: string[] | null },
  pathname: string,
): boolean {
  if (!pathname || pathname === '/') return true
  const allowed = resolveAllowedPages(p)
  for (const h of allowed) {
    if (pathname === h || pathname.startsWith(h + '/')) return true
  }
  return false
}

/** Validate a checkbox payload against the role's upper bound. Returns clean array or null. */
export function sanitizeAllowedPages(
  role: Role,
  raw: string[] | null | undefined,
): string[] | null {
  if (!raw) return null
  const upperBound = new Set<string>(ROLE_DEFAULTS[role])
  const set = new Set<string>()
  for (const h of raw) if (upperBound.has(h)) set.add(h)
  // null means "inherit role default" — store null when full set is selected
  if (set.size === upperBound.size) return null
  return Array.from(set)
}
