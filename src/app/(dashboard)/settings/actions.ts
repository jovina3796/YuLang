'use server'
import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'

export type CustomTheme = {
  bg:      string
  bg2:     string
  text:    string
  text2:   string
  border:  string
  accent:  string
  accent2: string
}

const HEX = /^#[0-9a-fA-F]{6}$/

function sanitize(t: Partial<CustomTheme> | null): CustomTheme | null {
  if (!t) return null
  const keys: (keyof CustomTheme)[] = ['bg','bg2','text','text2','border','accent','accent2']
  const out: any = {}
  for (const k of keys) {
    const v = t[k]
    if (typeof v !== 'string' || !HEX.test(v)) return null
    out[k] = v.toLowerCase()
  }
  return out as CustomTheme
}

export async function saveCustomTheme(theme: Partial<CustomTheme> | null) {
  const me = await getCurrentProfile()
  if (!me) return { ok: false, error: '未登入' }
  const clean = theme === null ? null : sanitize(theme)
  if (theme !== null && !clean) return { ok: false, error: '色碼格式錯誤' }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('user_profiles')
    .update({ theme: clean })
    .eq('id', me.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/', 'layout')
  return { ok: true }
}
