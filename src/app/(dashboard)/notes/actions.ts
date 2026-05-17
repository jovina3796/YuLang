'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export async function createNote(content: string) {
  if (!content.trim()) return { error: '內容空白' }
  const supabase = createServiceClient()
  const { error } = await supabase.from('notes').insert({ content: content.trim() })
  if (error) return { error: error.message }
  revalidatePath('/reports')
  revalidatePath('/dashboard')
  return { error: null }
}

export async function updateNote(id: string, content: string) {
  if (!content.trim()) return { error: '內容空白' }
  const supabase = createServiceClient()
  const { error } = await supabase.from('notes')
    .update({ content: content.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/reports')
  revalidatePath('/dashboard')
  return { error: null }
}

export async function deleteNote(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/reports')
  revalidatePath('/dashboard')
  return { error: null }
}
