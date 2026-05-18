export const PRICING_LABEL: Record<string, string> = {
  flat:           '固定運費',
  base_or_kpi:    '固定運費',
  per_stop_count: '趟次計費',
  pure_surcharge: '加成計費',
}

export const PRICING_MODE: Record<string, string> = {
  flat:            '固定運費',
  base_or_kpi:     '基本/KPI',
  per_stop_count:  '趟次計費',
  pure_surcharge:  '加成計費',
}

export function pricingLabel(
  name: string | null,
  warehouse: string | null,
  mode: string,
  fallback: Record<string, string> = PRICING_LABEL,
): string {
  const key = `${name ?? ''}${warehouse ? `-${warehouse}` : ''}`
  if (key === '全聯-桃園') return '籃件數計費'
  if (key === '全聯-瑞芳' || name === '鮮湧' || name === '弘舜') return '店點數計費'
  return fallback[mode] ?? mode
}

export function billingPeriodLabel(startDay: number, delay: number): string {
  const range = startDay === 26 ? '上月26日 ~ 當月25日' : '1日 ~ 月底'
  return `${range}（延後 ${delay} 個月支付）`
}
