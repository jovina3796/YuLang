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

export type RoleDefaults = Record<Role, readonly string[]>

// Static fallback used when DB read fails or in contexts where loading is not
// available. Admin-editable values live in role_permissions table (migration 028).
export const ROLE_DEFAULTS_FALLBACK: RoleDefaults = {
  admin:  NAV_HREFS,
  driver: ['/dashboard', '/payroll', '/claims', '/leaves', '/overtimes'],
}

// === Dashboard sections (Q2) ===
// Each represents one card on /dashboard. Admin can hide individual cards
// per role via /people?tab=permissions. Stored in role_permissions.allowed_dashboard_sections.
export const DASHBOARD_SECTIONS = [
  'kpi',
  'recent_trips',
  'maintenance',
  'vehicles',
  'people_approvals',
  'schedule',
  'pending_payments',
  'calendar',
  'notes',
  'login_info',
] as const
export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number]

export const DASHBOARD_SECTION_LABELS: Record<DashboardSection, string> = {
  kpi:              'KPI 數據（應收 / 油耗 / 營收）',
  recent_trips:     '車趟概覽',
  maintenance:      '維修紀錄',
  vehicles:         '車輛概況',
  people_approvals: '人員管理（待簽核）',
  schedule:         '本週排班表',
  pending_payments: '待支付款項',
  calendar:         '月曆與待辦',
  notes:            '備忘錄',
  login_info:       '登入資訊',
}

export type RoleDashboardSections = Record<Role, readonly DashboardSection[]>

export const DASHBOARD_SECTIONS_FALLBACK: RoleDashboardSections = {
  admin:  DASHBOARD_SECTIONS,
  driver: ['schedule', 'calendar', 'notes', 'login_info'],
}

/** Validate dashboard section payload against the canonical list. */
export function sanitizeDashboardSections(raw: string[] | null | undefined): string[] {
  const valid = new Set<string>(DASHBOARD_SECTIONS)
  if (!raw) return []
  return Array.from(new Set(raw.filter(s => valid.has(s))))
}

/**
 * Resolve the effective allow-set for a profile.
 * - allowed_pages null → role default
 * - allowed_pages non-null → intersection with role default (defence-in-depth)
 */
export function resolveAllowedPages(
  p: { role: Role; allowed_pages: string[] | null },
  defaults: RoleDefaults = ROLE_DEFAULTS_FALLBACK,
): Set<NavHref> {
  const roleSet = new Set<NavHref>(
    defaults[p.role].filter((h): h is NavHref => (NAV_HREFS as readonly string[]).includes(h)),
  )
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
  defaults: RoleDefaults = ROLE_DEFAULTS_FALLBACK,
): boolean {
  if (!pathname || pathname === '/') return true
  const allowed = resolveAllowedPages(p, defaults)
  for (const h of allowed) {
    if (pathname === h || pathname.startsWith(h + '/')) return true
  }
  return false
}

/** Validate a checkbox payload against the role's upper bound. Returns clean array or null. */
export function sanitizeAllowedPages(
  role: Role,
  raw: string[] | null | undefined,
  defaults: RoleDefaults = ROLE_DEFAULTS_FALLBACK,
): string[] | null {
  if (!raw) return null
  const upperBound = new Set<string>(defaults[role])
  const set = new Set<string>()
  for (const h of raw) if (upperBound.has(h)) set.add(h)
  // null means "inherit role default" — store null when full set is selected
  if (set.size === upperBound.size) return null
  return Array.from(set)
}
