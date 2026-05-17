import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type Role = 'admin' | 'driver'

export type Profile = {
  id:           string
  email:        string | null
  role:         Role
  driver_id:    string | null
  display_name: string | null
  avatar_url:   string | null
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()
  const { data: profile } = await service
    .from('user_profiles')
    .select('id, role, driver_id, display_name, avatar_url, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) return null

  return {
    id:           user.id,
    email:        user.email ?? null,
    role:         profile.role as Role,
    driver_id:    profile.driver_id,
    display_name: profile.display_name,
    avatar_url:   profile.avatar_url ?? null,
  }
}
