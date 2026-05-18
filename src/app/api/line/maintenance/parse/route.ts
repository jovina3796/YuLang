import { verifyAccessToken } from '@/lib/line/profile'
import { parseMaintenanceImage } from '@/lib/gemini'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/line/maintenance/parse — preview-only AI parse.
// Auth: Authorization: Bearer <LIFF access token>
// Body: multipart/form-data, field "file" = image / PDF
// Returns: ParsedMaintenance JSON. Does NOT touch the database.
export async function POST(request: Request): Promise<Response> {
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const profile = await verifyAccessToken(token)
  if (!profile) return Response.json({ error: 'unauthorized' }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: 'file_required' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: 'file_too_large', detail: '檔案需小於 10 MB' }, { status: 400 })
  }
  const mimeType = file.type || 'application/octet-stream'
  const allowed = ['image/', 'application/pdf']
  if (!allowed.some(p => mimeType.startsWith(p) || mimeType === p)) {
    return Response.json({ error: 'unsupported_type', detail: `不支援的檔案類型：${mimeType}` }, { status: 400 })
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const parsed = await parseMaintenanceImage(buf, mimeType)
    return Response.json({ ok: true, parsed })
  } catch (err) {
    console.error('[api.line.maintenance.parse] failed', err)
    const detail = err instanceof Error ? err.message : '未知錯誤'
    return Response.json({ error: 'ai_parse_failed', detail }, { status: 500 })
  }
}
