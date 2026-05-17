import { createServiceClient } from '@/lib/supabase/service'

export type SessionState =
  | 'idle'
  | 'binding'
  | 'fuel:date_choice'
  | 'fuel:date_input'
  | 'fuel:vehicle'
  | 'fuel:mileage'
  | 'fuel:total'
  | 'fuel:payment'
  | 'fuel:notes'
  | 'fuel:receipt'

export type SessionPayload = {
  // fuel flow
  logged_at?:        string          // ISO
  vehicle_id?:       string
  mileage_at_refuel?: number | null
  total_cost?:       number
  payment_method?:   string | null
  notes?:            string | null
  receipt_url?:      string | null
}

export interface Session {
  line_user_id: string
  state:        SessionState
  payload:      SessionPayload
}

export async function loadSession(lineUserId: string): Promise<Session> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('line_sessions')
    .select('line_user_id, state, payload')
    .eq('line_user_id', lineUserId)
    .maybeSingle()
  if (!data) return { line_user_id: lineUserId, state: 'idle', payload: {} }
  return {
    line_user_id: data.line_user_id,
    state:        data.state as SessionState,
    payload:      (data.payload ?? {}) as SessionPayload,
  }
}

export async function saveSession(s: Session): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('line_sessions')
    .upsert({
      line_user_id: s.line_user_id,
      state:        s.state,
      payload:      s.payload,
      updated_at:   new Date().toISOString(),
    })
}

export async function resetSession(lineUserId: string): Promise<void> {
  await saveSession({ line_user_id: lineUserId, state: 'idle', payload: {} })
}
