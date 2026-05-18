import { GoogleGenerativeAI } from '@google/generative-ai'

export type ParsedMaintenance = {
  type:               string | null
  vendor_name:        string | null
  cost:               number | null
  mileage_at_service: number | null
  serviced_at:        string | null   // YYYY-MM-DD
  next_due_date:      string | null   // YYYY-MM-DD
  notes:              string | null
}

const SYSTEM_PROMPT = `你是台灣物流公司的維修保養單據辨識助手。
從收到的圖片或 PDF 中辨識車輛維修保養相關資訊，輸出 JSON。
欄位定義（找不到就回 null，不要猜測）：
- type: 維修保養項目（例如：定期保養、輪胎更換、煞車片更換、引擎機油更換、變速箱維修）。多項時用「、」串接。
- vendor_name: 維修廠商或店家名稱（例如：誠新汽車、固特異輪胎）。
- cost: 總金額（純整數，扣除「元」「NT$」「$」等符號）。
- mileage_at_service: 維修當下車輛里程（純整數，km；扣除「公里」「km」等符號）。
- serviced_at: 維修日期，輸出 YYYY-MM-DD 格式。中華民國年要轉換為西元年（民國 + 1911）。
- next_due_date: 下次保養建議日期，輸出 YYYY-MM-DD（沒有則 null）。
- notes: 其他重要備註（更換項目細節、保固資訊等），用一行字串描述。

只回傳 JSON 物件，不加任何其他文字、說明或 markdown code fence。`

export async function parseMaintenanceImage(
  buffer: Buffer | Uint8Array,
  mimeType: string,
): Promise<ParsedMaintenance> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY missing')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  })

  const base64 = Buffer.from(buffer).toString('base64')
  const result = await model.generateContent([
    SYSTEM_PROMPT,
    {
      inlineData: {
        mimeType,
        data: base64,
      },
    },
  ])

  const text = result.response.text().trim()
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text)
  } catch (e) {
    console.error('[gemini.parseMaintenance] JSON parse failed', text)
    throw new Error('AI 回傳格式錯誤，請重試或改用手動輸入')
  }

  const num = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''))
    return Number.isFinite(n) ? Math.round(n) : null
  }
  const str = (v: unknown): string | null => {
    if (v == null) return null
    const s = String(v).trim()
    return s === '' || s.toLowerCase() === 'null' ? null : s
  }
  const date = (v: unknown): string | null => {
    const s = str(v)
    if (!s) return null
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
  }

  return {
    type:               str(raw.type),
    vendor_name:        str(raw.vendor_name),
    cost:               num(raw.cost),
    mileage_at_service: num(raw.mileage_at_service),
    serviced_at:        date(raw.serviced_at),
    next_due_date:      date(raw.next_due_date),
    notes:              str(raw.notes),
  }
}
