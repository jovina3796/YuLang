'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentProfile } from '@/lib/auth'
import { sanitizeAllowedPages } from '@/lib/permissions'
import { deriveDriverCredentials } from '@/lib/driverCredentials'

export type Role = 'admin' | 'driver'

export type UserInput = {
  email:         string
  password?:     string         // required on create only
  username:      string | null
  role:          Role
  driver_id:     string | null
  display_name:  string | null
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
    driver_id:     input.role === 'driver' ? input.driver_id : null,
    display_name:  input.display_name?.trim() || null,
    is_active:     input.is_active,
    allowed_pages: sanitizeAllowedPages(input.role, input.allowed_pages),
  })
  if (e2) {
    // Roll back the auth user so we don't leave orphans.
    await supabase.auth.admin.deleteUser(created.user.id)
    return { error: e2.message }
  }

  revalidatePath('/users')
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

  const { error: e1 } = await supabase.auth.admin.updateUserById(id, {
    email: input.email.trim(),
  })
  if (e1) return { error: e1.message }

  const { error: e2 } = await supabase.from('user_profiles').update({
    role:          input.role,
    username,
    driver_id:     input.role === 'driver' ? input.driver_id : null,
    display_name:  input.display_name?.trim() || null,
    is_active:     input.is_active,
    allowed_pages: sanitizeAllowedPages(input.role, input.allowed_pages),
  }).eq('id', id)
  if (e2) return { error: e2.message }

  revalidatePath('/users')
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
