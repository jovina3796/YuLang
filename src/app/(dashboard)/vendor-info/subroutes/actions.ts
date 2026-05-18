'use server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type SubrouteAliasInput = {
  alias:        string
  billing_area: string
}

export async function createSubrouteAlias(input: SubrouteAliasInput) {
  const supabase = createServiceClient()
  const alias = input.alias.trim()
  const billing = input.billing_area.trim()
  if (!alias || !billing) return { error: '配送區域與計價區域均不可為空' }
  const { error } = await supabase.from('subroute_aliases').insert({ alias, billing_area: billing })
  if (error) return { error: error.message }
  revalidatePath('/vendor-info/subroutes')
  return { error: null }
}

export async function updateSubrouteAlias(originalAlias: string, input: SubrouteAliasInput) {
  const supabase = createServiceClient()
  const alias = input.alias.trim()
  const billing = input.billing_area.trim()
  if (!alias || !billing) return { error: '配送區域與計價區域均不可為空' }
  const { error } = await supabase
    .from('subroute_aliases')
    .update({ alias, billing_area: billing, updated_at: new Date().toISOString() })
    .eq('alias', originalAlias)
  if (error) return { error: error.message }
  revalidatePath('/vendor-info/subroutes')
  return { error: null }
}

export async function deleteSubrouteAlias(alias: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('subroute_aliases').delete().eq('alias', alias)
  if (error) return { error: error.message }
  revalidatePath('/vendor-info/subroutes')
  return { error: null }
}
