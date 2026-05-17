'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type LeaveType = 'sick' | 'personal' | 'annual' | 'other'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export type LeaveInput = {
  driver_id:   string
  leave_type:  LeaveType
  start_date:  string
  end_date:    string
  hours:       number | null
  reason:      string | null
  notes:       string | null
  receipt_url: string | null
}

const BUCKET = 'leave-receipts'

export async function uploadLeaveReceipt(formData: FormData): Promise<{ url: string | null; error: string | null }> {
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

export async function createLeave(input: LeaveInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('driver_leaves').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/leaves'); revalidatePath('/dashboard')
  return { error: null }
}

export async function updateLeave(id: string, input: LeaveInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('driver_leaves').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/leaves'); revalidatePath('/dashboard')
  return { error: null }
}

export async function approveLeave(id: string, reviewer: string | null) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('driver_leaves').update({
    status: 'approved', reviewed_by: reviewer,
    reviewed_at: new Date().toISOString(), reject_reason: null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/leaves'); revalidatePath('/dashboard')
  return { error: null }
}

export async function rejectLeave(id: string, reviewer: string | null, reason: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('driver_leaves').update({
    status: 'rejected', reviewed_by: reviewer,
    reviewed_at: new Date().toISOString(), reject_reason: reason,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/leaves'); revalidatePath('/dashboard')
  return { error: null }
}

export async function deleteLeave(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('driver_leaves').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/leaves'); revalidatePath('/dashboard')
  return { error: null }
}
