'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type OvertimeStatus = 'pending' | 'approved' | 'rejected'

export type OvertimeInput = {
  driver_id:   string
  work_date:   string
  hours:       number
  reason:      string | null
  notes:       string | null
  receipt_url: string | null
}

const BUCKET = 'overtime-receipts'

export async function uploadOvertimeReceipt(formData: FormData): Promise<{ url: string | null; error: string | null }> {
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { url: null, error: null }
  const supabase = createServiceClient()
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${Date.now()}-${rand}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined, upsert: false,
  })
  if (error) return { url: null, error: error.message }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

export async function createOvertime(input: OvertimeInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('driver_overtimes').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/overtimes'); revalidatePath('/dashboard')
  return { error: null }
}

export async function updateOvertime(id: string, input: OvertimeInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('driver_overtimes').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/overtimes'); revalidatePath('/dashboard')
  return { error: null }
}

export async function approveOvertime(id: string, reviewer: string | null) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('driver_overtimes').update({
    status: 'approved', reviewed_by: reviewer,
    reviewed_at: new Date().toISOString(), reject_reason: null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/overtimes'); revalidatePath('/dashboard')
  return { error: null }
}

export async function rejectOvertime(id: string, reviewer: string | null, reason: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('driver_overtimes').update({
    status: 'rejected', reviewed_by: reviewer,
    reviewed_at: new Date().toISOString(), reject_reason: reason,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/overtimes'); revalidatePath('/dashboard')
  return { error: null }
}

export async function deleteOvertime(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('driver_overtimes').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/overtimes'); revalidatePath('/dashboard')
  return { error: null }
}
