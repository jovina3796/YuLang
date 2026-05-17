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
  | { type: 'flex'; altText: string; contents: FlexBubble; quickReply?: QuickReply }

export type FlexBubble = {
  type: 'bubble'
  size?: 'nano' | 'micro' | 'kilo' | 'mega' | 'giga'
  header?: FlexBox
  body?:   FlexBox
  footer?: FlexBox
  styles?: Record<string, unknown>
}

export type FlexComponent =
  | { type: 'text'; text: string; size?: string; weight?: 'bold' | 'regular'; color?: string; align?: 'start' | 'center' | 'end'; flex?: number; wrap?: boolean; margin?: string }
  | { type: 'separator'; margin?: string; color?: string }
  | { type: 'spacer'; size?: string }
  | { type: 'box'; layout: 'horizontal' | 'vertical' | 'baseline'; contents: FlexComponent[]; spacing?: string; margin?: string; backgroundColor?: string; paddingAll?: string }
  | { type: 'button'; style: 'primary' | 'secondary' | 'link'; color?: string; height?: 'sm' | 'md'; action: { type: 'uri'; label: string; uri: string } | { type: 'message'; label: string; text: string } }

export type FlexBox = Extract<FlexComponent, { type: 'box' }>

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

export function flexMessage(altText: string, contents: FlexBubble, quickReply?: QuickReply): LineMessage {
  return quickReply ? { type: 'flex', altText, contents, quickReply } : { type: 'flex', altText, contents }
}
