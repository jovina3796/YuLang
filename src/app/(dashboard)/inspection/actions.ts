'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type InspectionInput = {
  vehicle_id:         string
  inspected_at:       string
  result:             string | null
  fee:                number | null
  vendor_name:        string | null
  mileage_at_service: number | null
  next_due_date:      string | null
  license_url:        string | null
  receipt_url:        string | null
  deduct_month:       string | null
  notes:              string | null
}

const BUCKET = 'inspection-receipts'

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

export async function uploadInspectionFile(formData: FormData): Promise<{ url: string | null; error: string | null }> {
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

export async function createInspectionLog(input: InspectionInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('inspection_logs').insert(input)
  if (error) return { error: error.message }

  // Sync vehicle.last_inspection_date / next_inspection_date
  await supabase.from('vehicles').update({
    last_inspection_date: input.inspected_at,
    next_inspection_date: input.next_due_date,
  }).eq('id', input.vehicle_id)

  revalidatePath('/inspection')
  revalidatePath('/vehicles')
  return { error: null }
}

export async function updateInspectionLog(
  id: string,
  input: InspectionInput,
  oldLicenseUrl: string | null,
  oldReceiptUrl: string | null,
) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('inspection_logs').update(input).eq('id', id)
  if (error) return { error: error.message }
  if (oldLicenseUrl && oldLicenseUrl !== input.license_url) await removeStorageFile(oldLicenseUrl)
  if (oldReceiptUrl && oldReceiptUrl !== input.receipt_url) await removeStorageFile(oldReceiptUrl)
  revalidatePath('/inspection')
  revalidatePath('/vehicles')
  return { error: null }
}

export async function deleteInspectionLog(id: string, licenseUrl: string | null, receiptUrl: string | null) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('inspection_logs').delete().eq('id', id)
  if (error) return { error: error.message }
  if (licenseUrl) await removeStorageFile(licenseUrl)
  if (receiptUrl) await removeStorageFile(receiptUrl)
  revalidatePath('/inspection')
  return { error: null }
}
