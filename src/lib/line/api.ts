const REPLY_URL = 'https://api.line.me/v2/bot/message/reply'
const PUSH_URL  = 'https://api.line.me/v2/bot/message/push'
const CONTENT_URL = (id: string) => `https://api-data.line.me/v2/bot/message/${id}/content`

function token(): string {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!t) throw new Error('LINE_CHANNEL_ACCESS_TOKEN missing')
  return t
}

export type LineMessage =
  | { type: 'text'; text: string; quickReply?: QuickReply }

export type QuickReply = {
  items: Array<{
    type: 'action'
    action:
      | { type: 'message'; label: string; text: string }
      | { type: 'postback'; label: string; data: string; displayText?: string }
      | { type: 'datetimepicker'; label: string; data: string; mode: 'date' | 'time' | 'datetime' }
  }>
}

export async function reply(replyToken: string, messages: LineMessage[]): Promise<void> {
  const res = await fetch(REPLY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[line.reply] failed', res.status, body)
  }
}

export async function push(to: string, messages: LineMessage[]): Promise<void> {
  const res = await fetch(PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify({ to, messages }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[line.push] failed', res.status, body)
  }
}

export async function getMessageContent(messageId: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const res = await fetch(CONTENT_URL(messageId), {
    headers: { Authorization: `Bearer ${token()}` },
  })
  if (!res.ok) {
    console.error('[line.getMessageContent] failed', res.status)
    return null
  }
  const buffer = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
  return { buffer, contentType }
}

export function textMessage(text: string, quickReply?: QuickReply): LineMessage {
  return quickReply ? { type: 'text', text, quickReply } : { type: 'text', text }
}
