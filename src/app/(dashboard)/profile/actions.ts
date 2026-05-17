'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentProfile } from '@/lib/auth'

const AVATAR_BUCKET = 'avatars'

export async function uploadMyAvatar(formData: FormData): Promise<{ url: string | null; error: string | null }> {
  const me = await getCurrentProfile()
  if (!me) return { url: null, error: '未登入' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { url: null, error: '請選擇檔案' }
  if (!file.type.startsWith('image/')) return { url: null, error: '請選擇圖片檔' }
  if (file.size > 4 * 1024 * 1024) return { url: null, error: '檔案大小請小於 4MB' }

  const supabase = createServiceClient()
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${me.id}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    contentType: file.type || undefined, upsert: true,
  })
  if (error) return { url: null, error: error.message }
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

export async function updateMyProfile(input: { display_name: string | null; avatar_url: string | null }) {
  const me = await getCurrentProfile()
  if (!me) return { error: '未登入' }

  const supabase = createServiceClient()
  const { error } = await supabase.from('user_profiles').update({
    display_name: input.display_name?.trim() || null,
    avatar_url:   input.avatar_url || null,
  }).eq('id', me.id)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { error: null }
}

export async function changeMyPassword(currentPassword: string, newPassword: string) {
  const me = await getCurrentProfile()
  if (!me || !me.email) return { error: '未登入' }
  if (!newPassword || newPassword.length < 6) return { error: '新密碼至少 6 碼' }

  // Re-verify current password via service client to avoid clobbering the session.
  const service = createServiceClient()
  const { error: verifyError } = await service.auth.signInWithPassword({
    email: me.email,
    password: currentPassword,
  })
  if (verifyError) return { error: '目前密碼錯誤' }

  // Update via the session client so RLS / audit logs stay attached to the user.
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }
  return { error: null }
}
