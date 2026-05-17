import { createServiceClient } from '@/lib/supabase/service'

// Resolve a free-form payment input (e.g. "阿哲卡") to the canonical
// payment_method string by consulting the payment_aliases table.
// Returns null when nothing matches; the LINE flow then asks the driver
// to retry with the correct format.
//
// Match rule: longest alias whose text appears in the input wins.
// Comparison is case-insensitive and trims whitespace.
export async function resolvePaymentMethod(input: string): Promise<string | null> {
  const needle = input.trim().toLowerCase()
  if (!needle) return null

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('payment_aliases')
    .select('alias, target')
  const aliases = (data ?? []) as { alias: string; target: string }[]

  let best: { length: number; target: string } | null = null
  for (const { alias, target } of aliases) {
    const a = alias.toLowerCase()
    if (!a || !needle.includes(a)) continue
    if (!best || a.length > best.length) best = { length: a.length, target }
  }
  return best?.target ?? null
}
