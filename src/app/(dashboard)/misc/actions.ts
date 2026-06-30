'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type MiscTransactionInput = {
  type:             'income' | 'expense'
  category:         string | null
  amount:           number
  description:      string | null
  transaction_date: string
  deduct_month:     string | null
  notes:            string | null
  receipt_url:      string | null
  payment_method:   string | null
  payment_status:   'paid' | 'pending'
  due_date:         string | null
  paid_at:          string | null
  // ★ 新增這兩個選填欄位
  driver_id?:       string | null
  vehicle_id?:      string | null
}

const BUCKET = 'misc-receipts'

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

export async function uploadMiscReceipt(formData: FormData): Promise<{ url: string | null; error: string | null }> {
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

export async function createMiscTransaction(input: MiscTransactionInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('misc_transactions').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/misc')
  revalidatePath('/reports')
  return { error: null }
}

export async function updateMiscTransaction(
  id: string,
  input: MiscTransactionInput,
  oldReceiptUrl: string | null = null,
) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('misc_transactions').update(input).eq('id', id)
  if (error) return { error: error.message }
  if (oldReceiptUrl && oldReceiptUrl !== input.receipt_url) {
    await removeStorageFile(oldReceiptUrl)
  }
  revalidatePath('/misc')
  revalidatePath('/reports')
  return { error: null }
}

export async function deleteMiscTransaction(id: string, receiptUrl: string | null = null) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('misc_transactions').delete().eq('id', id)
  if (error) return { error: error.message }
  if (receiptUrl) await removeStorageFile(receiptUrl)
  revalidatePath('/misc')
  revalidatePath('/reports')
  return { error: null }
}
