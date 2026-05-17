'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentProfile } from '@/lib/auth'
import { NAV_HREFS, sanitizeAllowedPages, sanitizeDashboardSections } from '@/lib/permissions'
import { loadRoleDefaults } from '@/lib/rolePermissions.server'
import { deriveDriverCredentials } from '@/lib/driverCredentials'

export type Role = string

export type UserInput = {
  email:         string
  password?:     string         // required on create only
  username:      string | null
  role:          Role
  display_name:  string | null
  real_name:     string | null
  phone:         string | null
  line_user_id:  string | null
  is_active:     boolean
  allowed_pages: string[] | null
}

const USERNAME_RE = /^[a-z0-9._]{3,30}$/

function normalizeUsername(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().toLowerCase()
  return v || null
}

function validateUsername(v: string | null): string | null {
  if (v === null) return null
  if (!USERNAME_RE.test(v)) return '用戶名僅允許 3-30 個小寫英數、底線、點'
  return null
}

async function ensureAdmin() {
  const me = await getCurrentProfile()
  if (!me || me.role !== 'admin') return { error: '權限不足' }
  return { error: null as string | null, me }
}

/**
 * If a LINE userId is supplied, find the driver bound to it (if any) so we
 * can mirror driver_id onto the user_profiles row. Returns null when the
 * LINE userId is empty or no driver matches.
 */
async function resolveDriverIdFromLine(
  supabase: ReturnType<typeof createServiceClient>,
  lineUserId: string | null,
): Promise<string | null> {
  if (!lineUserId) return null
  const { data } = await supabase
    .from('drivers')
    .select('id').eq('line_user_id', lineUserId).maybeSingle()
  return data?.id ?? null
}

export async function createUser(input: UserInput) {
  const guard = await ensureAdmin()
  if (guard.error) return { error: guard.error }
  if (!input.email.trim()) return { error: '請輸入 E-Mail' }
  if (!input.password || input.password.length < 6) return { error: '密碼至少 6 碼' }

  const username = normalizeUsername(input.username)
  const usernameError = validateUsername(username)
  if (usernameError) return { error: usernameError }

  const supabase = createServiceClient()

  if (username) {
    const { data: dup } = await supabase
      .from('user_profiles')
      .select('id').ilike('username', username).maybeSingle()
    if (dup) return { error: '用戶名已被使用' }
  }

  const lineUserId = input.line_user_id?.trim() || null
  const driverId   = await resolveDriverIdFromLine(supabase, lineUserId)
  const defaults   = await loadRoleDefaults()

  const { data: created, error: e1 } = await supabase.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
  })
  if (e1 || !created.user) return { error: e1?.message ?? '建立帳號失敗' }

  const { error: e2 } = await supabase.from('user_profiles').insert({
    id:            created.user.id,
    role:          input.role,
    username,
    driver_id:     driverId,
    display_name:  input.display_name?.trim() || null,
    real_name:     input.real_name?.trim()    || null,
    phone:         input.phone?.trim()        || null,
    line_user_id:  lineUserId,
    is_active:     input.is_active,
    allowed_pages: sanitizeAllowedPages(input.role, input.allowed_pages, defaults),
  })
  if (e2) {
    // Roll back the auth user so we don't leave orphans.
    await supabase.auth.admin.deleteUser(created.user.id)
    return { error: e2.message }
  }

  revalidatePath('/people')
  return { error: null }
}

export async function updateUser(id: string, input: Omit<UserInput, 'password'>) {
  const guard = await ensureAdmin()
  if (guard.error) return { error: guard.error }
  if (!input.email.trim()) return { error: '請輸入 E-Mail' }

  const username = normalizeUsername(input.username)
  const usernameError = validateUsername(username)
  if (usernameError) return { error: usernameError }

  const supabase = createServiceClient()

  if (username) {
    const { data: dup } = await supabase
      .from('user_profiles')
      .select('id').ilike('username', username).neq('id', id).maybeSingle()
    if (dup) return { error: '用戶名已被使用' }
  }

  const lineUserId = input.line_user_id?.trim() || null
  // Re-resolve driver_id from the (possibly changed) LINE userId. Setting LINE
  // to empty also clears driver_id — admin clears association by clearing LINE.
  const driverId = await resolveDriverIdFromLine(supabase, lineUserId)
  const defaults = await loadRoleDefaults()

  const { error: e1 } = await supabase.auth.admin.updateUserById(id, {
    email: input.email.trim(),
  })
  if (e1) return { error: e1.message }

  const { error: e2 } = await supabase.from('user_profiles').update({
    role:          input.role,
    username,
    driver_id:     driverId,
    display_name:  input.display_name?.trim() || null,
    real_name:     input.real_name?.trim()    || null,
    phone:         input.phone?.trim()        || null,
    line_user_id:  lineUserId,
    is_active:     input.is_active,
    allowed_pages: sanitizeAllowedPages(input.role, input.allowed_pages, defaults),
  }).eq('id', id)
  if (e2) return { error: e2.message }

  revalidatePath('/people')
  return { error: null }
}

export async function resetUserPassword(id: string, password: string) {
  const guard = await ensureAdmin()
  if (guard.error) return { error: guard.error }
  if (!password || password.length < 6) return { error: '密碼至少 6 碼' }

  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.updateUserById(id, { password })
  if (error) return { error: error.message }
  return { error: null }
}

export async function deleteUser(id: string) {
  const guard = await ensureAdmin()
  if (guard.error) return { error: guard.error }
  if (guard.me && guard.me.id === id) return { error: '不能刪除自己' }

  const supabase = createServiceClient()
  // user_profiles row cascades via FK ON DELETE CASCADE.
  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) return { error: error.message }
  revalidatePath('/users')
  return { error: null }
}

/**
 * Create a Supabase auth user + user_profiles row for an existing driver.
 * - Skips silently when driver already has a user_profile, when phone is empty,
 *   or when an account with the derived email already exists.
 * - Called both from createDriver (auto) and from the Pending list UI (manual).
 * Caller may set { adminGuard: false } to allow internal callers to bypass the
 * admin check; default true for direct UI invocations.
 */
export async function createUserForDriver(
  driverId: string,
  opts: { adminGuard?: boolean } = {},
) {
  if (opts.adminGuard !== false) {
    const guard = await ensureAdmin()
    if (guard.error) return { error: guard.error, skipped: false }
  }

  const supabase = createServiceClient()

  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('id').eq('driver_id', driverId).maybeSingle()
  if (existingProfile) return { error: null, skipped: true, reason: 'already-has-account' }

  const { data: driver, error: dErr } = await supabase
    .from('drivers')
    .select('id, name, phone')
    .eq('id', driverId)
    .maybeSingle()
  if (dErr || !driver) return { error: dErr?.message ?? '找不到司機', skipped: false }

  const cred = deriveDriverCredentials(driver.phone)
  if (!cred) return { error: null, skipped: true, reason: 'no-phone' }

  const { data: created, error: e1 } = await supabase.auth.admin.createUser({
    email: cred.email,
    password: cred.password,
    email_confirm: true,
  })
  if (e1 || !created.user) {
    // Email might already exist if admin created manually first; treat as skip.
    if (e1?.message?.toLowerCase().includes('already')) {
      return { error: null, skipped: true, reason: 'email-exists' }
    }
    return { error: e1?.message ?? '建立帳號失敗', skipped: false }
  }

  const { error: e2 } = await supabase.from('user_profiles').insert({
    id:            created.user.id,
    role:          'driver' as Role,
    username:      cred.username,
    driver_id:     driverId,
    display_name:  driver.name,
    real_name:     driver.name,
    phone:         driver.phone ?? null,
    is_active:     true,
    allowed_pages: null,
  })
  if (e2) {
    await supabase.auth.admin.deleteUser(created.user.id)
    return { error: e2.message, skipped: false }
  }

  revalidatePath('/people')
  return { error: null, skipped: false, credentials: cred }
}

/** Clear LINE binding from BOTH drivers and user_profiles in one shot. */
export async function unbindLine(driverId: string) {
  const guard = await ensureAdmin()
  if (guard.error) return { error: guard.error }

  const supabase = createServiceClient()
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from('drivers').update({ line_user_id: null }).eq('id', driverId),
    supabase.from('user_profiles').update({ line_user_id: null }).eq('driver_id', driverId),
  ])
  if (e1 || e2) return { error: (e1 ?? e2)!.message }

  revalidatePath('/people')
  return { error: null }
}

/**
 * Save the default allow-set for a role (upper bound for per-user
 * allowed_pages). Validates each entry against NAV_HREFS to prevent injection.
 */
export async function saveRoleDefaults(role: Role, allowedPages: string[]) {
  const guard = await ensureAdmin()
  if (guard.error) return { error: guard.error }

  const supabase = createServiceClient()
  const { data: roleRow } = await supabase
    .from('roles').select('key').eq('key', role).maybeSingle()
  if (!roleRow) return { error: '無效的角色' }

  const valid = new Set<string>(NAV_HREFS)
  const cleaned = Array.from(new Set(allowedPages.filter(h => valid.has(h))))
  // Dashboard must always be in every role's default so a user never lands
  // somewhere they can't see anything.
  if (!cleaned.includes('/dashboard')) cleaned.unshift('/dashboard')

  const { error } = await supabase
    .from('role_permissions')
    .upsert({ role, allowed_pages: cleaned, updated_at: new Date().toISOString() })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { error: null }
}

/** Save the default visible dashboard section list for a role. */
export async function saveRoleDashboardSections(role: Role, sections: string[]) {
  const guard = await ensureAdmin()
  if (guard.error) return { error: guard.error }

  const supabase = createServiceClient()
  const { data: roleRow } = await supabase
    .from('roles').select('key').eq('key', role).maybeSingle()
  if (!roleRow) return { error: '無效的角色' }

  const cleaned = sanitizeDashboardSections(sections)

  // Upsert without clobbering allowed_pages: if row missing we still need it
  // to exist before we can update sections, so first ensure row, then update.
  const { error: upErr } = await supabase
    .from('role_permissions')
    .update({ allowed_dashboard_sections: cleaned, updated_at: new Date().toISOString() })
    .eq('role', role)
  if (upErr) return { error: upErr.message }

  revalidatePath('/dashboard')
  return { error: null }
}

const ROLE_KEY_RE = /^[a-z][a-z0-9_]{1,30}$/

export async function createRole(input: { key: string; label: string; badge_class: string }) {
  const guard = await ensureAdmin()
  if (guard.error) return { error: guard.error }

  const key   = input.key.trim().toLowerCase()
  const label = input.label.trim()
  const badge = input.badge_class.trim() || 'badge-blue'
  if (!ROLE_KEY_RE.test(key)) return { error: 'key 僅允許小寫英數字與底線，且須以字母開頭（2-31 字）' }
  if (!label)                 return { error: '請輸入顯示名稱' }

  const supabase = createServiceClient()
  const { data: dup } = await supabase
    .from('roles').select('key').eq('key', key).maybeSingle()
  if (dup) return { error: '角色 key 已存在' }

  const { error: e1 } = await supabase
    .from('roles')
    .insert({ key, label, badge_class: badge, is_builtin: false, sort_order: 100 })
  if (e1) return { error: e1.message }

  const { error: e2 } = await supabase
    .from('role_permissions')
    .insert({ role: key, allowed_pages: ['/dashboard'] })
  if (e2) {
    await supabase.from('roles').delete().eq('key', key)
    return { error: e2.message }
  }

  revalidatePath('/', 'layout')
  return { error: null }
}

export async function updateRole(key: string, patch: { label?: string; badge_class?: string }) {
  const guard = await ensureAdmin()
  if (guard.error) return { error: guard.error }

  const supabase = createServiceClient()
  const update: Record<string, unknown> = {}
  if (patch.label !== undefined) {
    const v = patch.label.trim()
    if (!v) return { error: '請輸入顯示名稱' }
    update.label = v
  }
  if (patch.badge_class !== undefined) {
    update.badge_class = patch.badge_class.trim() || 'badge-blue'
  }
  if (!Object.keys(update).length) return { error: null }

  const { error } = await supabase.from('roles').update(update).eq('key', key)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { error: null }
}

/**
 * Delete a custom role. Refuses built-ins. Reassigns any user_profiles still
 * pointing at this role to 'driver' inside a single Postgres function so the
 * RESTRICT FK never fires. Returns the number of accounts migrated.
 */
export async function deleteRole(key: string) {
  const guard = await ensureAdmin()
  if (guard.error) return { error: guard.error, migrated: 0 }

  const supabase = createServiceClient()
  const { data: row } = await supabase
    .from('roles').select('key, is_builtin').eq('key', key).maybeSingle()
  if (!row)            return { error: '角色不存在', migrated: 0 }
  if (row.is_builtin)  return { error: '內建角色不可刪除', migrated: 0 }

  const { data, error } = await supabase.rpc('delete_role', { p_key: key })
  if (error) return { error: error.message, migrated: 0 }

  revalidatePath('/', 'layout')
  return { error: null, migrated: (data as number) ?? 0 }
}

/** Count user_profiles still attached to a role — used for the delete confirm dialog. */
export async function countUsersInRole(key: string) {
  const guard = await ensureAdmin()
  if (guard.error) return { error: guard.error, count: 0 }

  const supabase = createServiceClient()
  const { count, error } = await supabase
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', key)
  if (error) return { error: error.message, count: 0 }
  return { error: null, count: count ?? 0 }
}
