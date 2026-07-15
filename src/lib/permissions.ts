import type { Role } from '@/lib/auth'

// Every nav route the app exposes. Order matches Sidebar groups so admin
// checkbox UI reads top-to-bottom in the same order as the sidebar.
// /people is split into 3 sub-routes so admin can grant per-tab access
// (e.g. accountant sees /people/drivers but not /people/users).
export const NAV_HREFS = [
  '/dashboard',
  '/trips',
  '/vehicles',
  '/people/drivers',
  '/people/users',
  '/people/permissions',
  '/people/reminders',
  '/schedule',
  '/fuel',
  '/maintenance',
  '/inspection',
  '/reports',
  '/finance',
  '/payroll',
  '/vendor-info/vendors',
  '/vendor-info/rates',
  '/vendor-info/subroutes',
  '/vendor-info/driver-rates',
  '/vendor-info/surcharges',
  '/claims',
  '/leaves',
  '/overtimes',
  '/settings',
] as const
export type NavHref = (typeof NAV_HREFS)[number]

export const NAV_LABELS: Record<NavHref, string> = {
  '/dashboard':               '儀表板',
  '/trips':                   '車趟紀錄',
  '/vehicles':                '車輛列表',
  '/people/drivers':          '人員管理 — 司機資料',
  '/people/users':            '人員管理 — 登入帳號',
  '/people/permissions':      '人員管理 — 權限設定',
  '/people/reminders':     '廠商資訊 — 定時提醒管理',
  '/schedule':                '排班設定',
  '/fuel':                    '加油紀錄',
  '/maintenance':             '保養維修',
  '/inspection':              '驗車紀錄',
  '/reports':                 '統計報表',
  '/finance':                 '收支報表',
  '/payroll':                 '薪資單據',
  '/vendor-info/vendors':     '廠商資訊 — 廠商設定',
  '/vendor-info/rates':       '廠商資訊 — 運費設定',
  '/vendor-info/subroutes':   '廠商資訊 — 配送區域對應',
  '/vendor-info/driver-rates':'廠商資訊 — 例外抽成設定', 
  '/vendor-info/surcharges':   '廠商資訊 — 特殊加成設定',
  '/claims':                  '請款簽核',
  '/leaves':                  '請假簽核',
  '/overtimes':               '加班簽核',
  '/settings':                '系統設定',
}

// Sidebar groups multiple sub-routes under a single parent label. Each entry
// here drives one Sidebar link: visible iff any sub is allowed; navigates to
// the first allowed sub.
export const NAV_PARENTS: Record<string, { label: string; subs: NavHref[] }> = {
  '/people': {
    label: '人員管理',
    subs:  ['/people/drivers', '/people/users', '/people/permissions', '/people/reminders'],
  },
  '/vendor-info': {
    label: '廠商資訊',
    subs:  ['/vendor-info/vendors', '/vendor-info/rates', '/vendor-info/subroutes', '/vendor-info/driver-rates', '/vendor-info/surcharges'],
  },
}

export type RoleDefaults = Record<string, readonly string[]>

// Static fallback used when DB read fails or in contexts where loading is not
// available. Admin-editable values live in role_permissions table (migration 028).
// Custom roles default to /dashboard only when no DB row is loaded.
export const ROLE_DEFAULTS_FALLBACK: RoleDefaults = {
  admin:  NAV_HREFS,
  driver: ['/dashboard', '/payroll', '/claims', '/leaves', '/overtimes'],
}

function defaultsFor(role: Role, defaults: RoleDefaults): readonly string[] {
  return defaults[role] ?? ['/dashboard']
}

// === Dashboard sections (Q2) ===
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

export type RoleDashboardSections = Record<string, readonly DashboardSection[]>

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

// === Per-resource data scope (Q3) ===
export const SCOPED_RESOURCES = ['trips'] as const
export type ScopedResource = (typeof SCOPED_RESOURCES)[number]
export type DataScopeValue = 'all' | 'self'
export type DataScope = Partial<Record<ScopedResource, DataScopeValue>>
export type RoleDataScopes = Record<string, DataScope>

export const SCOPED_RESOURCE_LABELS: Record<ScopedResource, string> = {
  trips: '車趟紀錄',
}

export const DATA_SCOPE_FALLBACK: RoleDataScopes = {
  admin:  { trips: 'all' },
  driver: { trips: 'self' },
}

/** Resolve a single resource's effective scope for a role, defaulting to 'all'. */
export function scopeFor(scopes: RoleDataScopes, role: Role, resource: ScopedResource): DataScopeValue {
  return scopes[role]?.[resource] ?? 'all'
}

/** Validate scope payload against canonical resources/values. */
export function sanitizeDataScope(raw: unknown): DataScope {
  const out: DataScope = {}
  if (!raw || typeof raw !== 'object') return out
  for (const r of SCOPED_RESOURCES) {
    const v = (raw as Record<string, unknown>)[r]
    if (v === 'all' || v === 'self') out[r] = v
  }
  return out
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
    defaultsFor(p.role, defaults).filter((h): h is NavHref => (NAV_HREFS as readonly string[]).includes(h)),
  )
  
  let out: Set<NavHref>
  if (!p.allowed_pages) {
    out = roleSet
  } else {
    out = new Set<NavHref>()
    for (const h of p.allowed_pages) {
      if (roleSet.has(h as NavHref)) out.add(h as NavHref)
    }
  }

  if (out.has('/people/drivers')) {
    out.add('/people/reminders') 
  }

  if (out.has('/vendor-info/rates')) {
    out.add('/vendor-info/driver-rates')
    out.add('/vendor-info/surcharges')
  }

  return out
}

/**
 * Pathname permission check.
 */
export function canAccess(
  p: { role: Role; allowed_pages: string[] | null },
  pathname: string,
  defaults: RoleDefaults = ROLE_DEFAULTS_FALLBACK,
): boolean {
  if (!pathname || pathname === '/') return true
  const allowed = resolveAllowedPages(p, defaults)
  for (const h of allowed) {
    if (pathname === h) return true
    if (pathname.startsWith(h + '/')) return true
    if (h.startsWith(pathname + '/')) return true
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
  const upperBound = new Set<string>(defaultsFor(role, defaults))
  const set = new Set<string>()
  for (const h of raw) if (upperBound.has(h)) set.add(h)
  if (set.size === upperBound.size) return null
  return Array.from(set)
}
