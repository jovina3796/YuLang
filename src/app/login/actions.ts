'use server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'

export async function signIn(formData: FormData): Promise<{ error: string | null }> {
  const identifier = String(formData.get('email') ?? '').trim()
  const password   = String(formData.get('password') ?? '')

  if (!identifier || !password) return { error: '請輸入帳號與密碼' }

  let email = identifier
  if (!identifier.includes('@')) {
    // Treat as username: look up the linked auth.users email via service client.
    const service = createServiceClient()
    const { data: profile } = await service
      .from('user_profiles')
      .select('id')
      .ilike('username', identifier)
      .maybeSingle()
    if (!profile) return { error: '帳號或密碼錯誤' }

    const { data: userRes, error: userErr } = await service.auth.admin.getUserById(profile.id)
    if (userErr || !userRes.user?.email) return { error: '帳號或密碼錯誤' }
    email = userRes.user.email
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: '帳號或密碼錯誤' }
  return { error: null }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
