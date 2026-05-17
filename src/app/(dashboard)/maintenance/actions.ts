'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type MaintenanceInput = {
  vehicle_id:         string
  type:               string
  vendor_name:        string | null
  cost:               number | null
  mileage_at_service: number | null
  serviced_at:        string
  next_due_date:      string | null
  deduct_month:       string | null
  notes:              string | null
  receipt_url:        string | null
}

const BUCKET = 'maintenance-receipts'

function pathFromUrl(url: string | null): string | null {
  if (!url) return null
  const marker = `/${BUCKET}/`
  const i = url.indexOf(marker)
  if (i < 0) return null
  return url.slice(i + marker.length)
}

async function removeStorageFile(url: string | null) {
  const path = pathFromUrl(url)
  if (!path) return
  const supabase = createServiceClient()
  await supabase.storage.from(BUCKET).remove([path])
}

export async function uploadReceipt(formData: FormData): Promise<{ url: string | null; error: string | null }> {
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { url: null, error: null }

  const supabase = createServiceClient()
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${Date.now()}-${rand}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

export async function createMaintenanceLog(input: MaintenanceInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('maintenance_logs').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/maintenance')
  return { error: null }
}

export async function updateMaintenanceLog(
  id: string,
  input: MaintenanceInput,
  oldReceiptUrl: string | null,
) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('maintenance_logs').update(input).eq('id', id)
  if (error) return { error: error.message }
  if (oldReceiptUrl && oldReceiptUrl !== input.receipt_url) {
    await removeStorageFile(oldReceiptUrl)
  }
  revalidatePath('/maintenance')
  return { error: null }
}

export async function deleteMaintenanceLog(id: string, receiptUrl: string | null) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('maintenance_logs').delete().eq('id', id)
  if (error) return { error: error.message }
  if (receiptUrl) await removeStorageFile(receiptUrl)
  revalidatePath('/maintenance')
  return { error: null }
}
