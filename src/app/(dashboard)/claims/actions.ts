'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type ClaimType = 'parking' | 'fine' | 'supply' | 'other'
export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'paid'

export type ClaimInput = {
  driver_id:    string
  claim_type:   ClaimType
  category:     string | null
  amount:       number
  occurred_at:  string
  receipt_url:  string | null
  notes:        string | null
}

const BUCKET = 'claim-receipts'

export async function uploadClaimReceipt(formData: FormData): Promise<{ url: string | null; error: string | null }> {
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

export async function createClaim(input: ClaimInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('driver_claims').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/claims')
  revalidatePath('/dashboard')
  return { error: null }
}

export async function updateClaim(id: string, input: ClaimInput) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('driver_claims').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/claims')
  revalidatePath('/dashboard')
  return { error: null }
}

export async function approveClaim(id: string, reviewer: string | null) {
  const supabase = createServiceClient()

  // Load the claim
  const { data: claim, error: e1 } = await supabase.from('driver_claims')
    .select('id, driver_id, claim_type, category, amount, occurred_at, receipt_url, notes, drivers(name)')
    .eq('id', id).single()
  if (e1 || !claim) return { error: e1?.message ?? '請款不存在' }

  // Insert paired misc_transactions row (pending payment)
  const driverName = (claim as any).drivers?.name ?? ''
  const description = `${driverName}：${claim.category ?? ({
    parking: '停車費', fine: '罰單', supply: '消耗品', other: '其他',
  } as Record<string, string>)[claim.claim_type] ?? '請款'}`

  const { data: tx, error: e2 } = await supabase.from('misc_transactions').insert({
    type: 'expense',
    category: ({
      parking: '停車費', fine: '罰單', supply: '消耗品', other: '其他',
    } as Record<string, string>)[claim.claim_type] ?? '請款',
    amount: claim.amount,
    description,
    transaction_date: claim.occurred_at,
    deduct_month: null,
    notes: claim.notes,
    receipt_url: claim.receipt_url,
    payment_method: '現金',
    payment_status: 'pending',
    due_date: null,
    paid_at: null,
  }).select('id').single()
  if (e2 || !tx) return { error: e2?.message ?? '建立支付項目失敗' }

  const { error: e3 } = await supabase.from('driver_claims').update({
    status: 'approved',
    reviewed_by: reviewer,
    reviewed_at: new Date().toISOString(),
    misc_tx_id: tx.id,
    reject_reason: null,
  }).eq('id', id)
  if (e3) return { error: e3.message }

  revalidatePath('/claims'); revalidatePath('/misc'); revalidatePath('/dashboard')
  return { error: null }
}

export async function rejectClaim(id: string, reviewer: string | null, reason: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('driver_claims').update({
    status: 'rejected',
    reviewed_by: reviewer,
    reviewed_at: new Date().toISOString(),
    reject_reason: reason,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/claims'); revalidatePath('/dashboard')
  return { error: null }
}

export async function markClaimPaid(id: string) {
  const supabase = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: claim, error: e1 } = await supabase.from('driver_claims')
    .select('misc_tx_id').eq('id', id).single()
  if (e1 || !claim) return { error: e1?.message ?? '請款不存在' }

  if (claim.misc_tx_id) {
    await supabase.from('misc_transactions').update({
      payment_status: 'paid', paid_at: today,
    }).eq('id', claim.misc_tx_id)
  }

  const { error } = await supabase.from('driver_claims').update({
    status: 'paid', paid_at: today,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/claims'); revalidatePath('/misc'); revalidatePath('/dashboard')
  return { error: null }
}

export async function deleteClaim(id: string) {
  const supabase = createServiceClient()
  // Also clear linked misc_transactions if still pending
  const { data: claim } = await supabase.from('driver_claims')
    .select('misc_tx_id').eq('id', id).single()
  if (claim?.misc_tx_id) {
    await supabase.from('misc_transactions')
      .delete().eq('id', claim.misc_tx_id).eq('payment_status', 'pending')
  }
  const { error } = await supabase.from('driver_claims').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/claims'); revalidatePath('/misc'); revalidatePath('/dashboard')
  return { error: null }
}
