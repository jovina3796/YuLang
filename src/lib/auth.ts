import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type Role = 'admin' | 'driver'

export type CustomTheme = {
  bg:      string
  bg2:     string
  text:    string
  text2:   string
  border:  string
  accent:  string
  accent2: string
}

export type Profile = {
  id:            string
  email:         string | null
  role:          Role
  driver_id:     string | null
  display_name:  string | null
  avatar_url:    string | null
  theme:         CustomTheme | null
  line_user_id:  string | null
  allowed_pages: string[] | null
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()
  const { data: profile } = await service
    .from('user_profiles')
    .select('id, role, driver_id, display_name, avatar_url, is_active, theme, line_user_id, allowed_pages')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) return null

  return {
    id:            user.id,
    email:         user.email ?? null,
    role:          profile.role as Role,
    driver_id:     profile.driver_id,
    display_name:  profile.display_name,
    avatar_url:    profile.avatar_url ?? null,
    theme:         (profile.theme ?? null) as CustomTheme | null,
    line_user_id:  profile.line_user_id ?? null,
    allowed_pages: (profile.allowed_pages ?? null) as string[] | null,
  }
}
