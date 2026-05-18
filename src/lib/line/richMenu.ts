const API = 'https://api.line.me/v2/bot'
const DATA_API = 'https://api-data.line.me/v2/bot'

function token(): string {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!t) throw new Error('LINE_CHANNEL_ACCESS_TOKEN missing')
  return t
}

export type RichMenuArea = {
  bounds: { x: number; y: number; width: number; height: number }
  action:
    | { type: 'message'; label?: string; text: string }
    | { type: 'uri'; label?: string; uri: string }
    | { type: 'postback'; label?: string; data: string; displayText?: string }
}

export type RichMenu = {
  size: { width: number; height: number }
  selected: boolean
  name: string
  chatBarText: string
  areas: RichMenuArea[]
}

export async function createRichMenu(menu: RichMenu): Promise<string> {
  const res = await fetch(`${API}/richmenu`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify(menu),
  })
  if (!res.ok) throw new Error(`createRichMenu failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { richMenuId: string }
  return json.richMenuId
}

export async function uploadRichMenuImage(richMenuId: string, png: Buffer): Promise<void> {
  const res = await fetch(`${DATA_API}/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      Authorization: `Bearer ${token()}`,
    },
    body: new Uint8Array(png),
  })
  if (!res.ok) throw new Error(`uploadRichMenuImage failed: ${res.status} ${await res.text()}`)
}

export async function setDefaultRichMenu(richMenuId: string): Promise<void> {
  const res = await fetch(`${API}/user/all/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}` },
  })
  if (!res.ok) throw new Error(`setDefaultRichMenu failed: ${res.status} ${await res.text()}`)
}

export async function listRichMenus(): Promise<Array<{ richMenuId: string; name: string }>> {
  const res = await fetch(`${API}/richmenu/list`, {
    headers: { Authorization: `Bearer ${token()}` },
  })
  if (!res.ok) throw new Error(`listRichMenus failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { richmenus: Array<{ richMenuId: string; name: string }> }
  return json.richmenus
}

export async function deleteRichMenu(richMenuId: string): Promise<void> {
  const res = await fetch(`${API}/richmenu/${richMenuId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token()}` },
  })
  if (!res.ok) throw new Error(`deleteRichMenu failed: ${res.status} ${await res.text()}`)
}

export async function getDefaultRichMenuId(): Promise<string | null> {
  const res = await fetch(`${API}/user/all/richmenu`, {
    headers: { Authorization: `Bearer ${token()}` },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`getDefaultRichMenuId failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { richMenuId: string }
  return json.richMenuId
}
