/* eslint-disable no-console */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import {
  createRichMenu,
  uploadRichMenuImage,
  setDefaultRichMenu,
  getDefaultRichMenuId,
  deleteRichMenu,
  type RichMenu,
} from '../src/lib/line/richMenu'

// Try to load .env.local manually since dotenv/config only reads .env
try {
  const envLocal = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of envLocal.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
} catch { /* .env.local optional */ }

const WIDTH = 2500
const HEIGHT = 843
const COLS = 4
const CELL_W = Math.floor(WIDTH / COLS) // 625
const CELL_H = HEIGHT

type Cell = {
  label: string
  bg: string
  fg: string
  action: RichMenuArea['action']
}

type RichMenuArea = RichMenu['areas'][number]

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://yulang-erp.vercel.app/'
const LIFF_FUEL = process.env.NEXT_PUBLIC_LIFF_ID
const LIFF_TRIP = process.env.NEXT_PUBLIC_LIFF_ID_TRIP
const LIFF_MAINTENANCE = process.env.NEXT_PUBLIC_LIFF_ID_MAINTENANCE

function liffUri(id: string | undefined, fallbackText: string): RichMenuArea['action'] {
  return id
    ? { type: 'uri', label: fallbackText, uri: `https://liff.line.me/${id}` }
    : { type: 'message', label: fallbackText, text: fallbackText }
}

const CELLS: Cell[] = [
  { label: '加油',     bg: '#0EA5E9', fg: '#FFFFFF', action: liffUri(LIFF_FUEL,        '加油') },
  { label: '車趟',     bg: '#10B981', fg: '#FFFFFF', action: liffUri(LIFF_TRIP,        '車趟') },
  { label: '維修保養', bg: '#F59E0B', fg: '#FFFFFF', action: liffUri(LIFF_MAINTENANCE, '維修') },
  { label: '系統',     bg: '#6366F1', fg: '#FFFFFF', action: { type: 'uri', label: '系統', uri: SITE_URL } },
]

function buildSvg(): string {
  const blocks = CELLS.map((c, i) => {
    const x = i * CELL_W
    return `<rect x="${x}" y="0" width="${CELL_W}" height="${CELL_H}" fill="${c.bg}"/>` +
           `<text x="${x + CELL_W / 2}" y="${CELL_H / 2}" font-family="Microsoft JhengHei, PingFang TC, Heiti TC, Noto Sans CJK TC, sans-serif" font-size="180" font-weight="700" fill="${c.fg}" text-anchor="middle" dominant-baseline="central">${c.label}</text>`
  }).join('')
  // White vertical separators
  const seps = Array.from({ length: COLS - 1 }, (_, i) =>
    `<rect x="${(i + 1) * CELL_W - 2}" y="0" width="4" height="${CELL_H}" fill="rgba(255,255,255,0.18)"/>`
  ).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">${blocks}${seps}</svg>`
}

async function generatePng(): Promise<Buffer> {
  const svg = Buffer.from(buildSvg())
  return sharp(svg).png({ compressionLevel: 9 }).toBuffer()
}

async function main(): Promise<void> {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN missing in env (.env.local).')
    process.exit(1)
  }

  console.log('Generating rich menu PNG...')
  const png = await generatePng()
  console.log(`PNG ready, ${png.byteLength} bytes`)

  // Remove previous default menu so we don't accumulate stale menus.
  const prev = await getDefaultRichMenuId()
  if (prev) {
    console.log(`Found existing default rich menu ${prev}, deleting...`)
    try { await deleteRichMenu(prev) } catch (e) { console.warn('delete previous failed', e) }
  }

  const menu: RichMenu = {
    size: { width: WIDTH, height: HEIGHT },
    selected: true,
    name: 'yulang-driver-menu',
    chatBarText: '司機快速指令',
    areas: CELLS.map((c, i) => ({
      bounds: { x: i * CELL_W, y: 0, width: CELL_W, height: CELL_H },
      action: c.action,
    })),
  }

  console.log('Creating rich menu...')
  const id = await createRichMenu(menu)
  console.log(`Rich menu created: ${id}`)

  console.log('Uploading PNG...')
  await uploadRichMenuImage(id, png)

  console.log('Setting as default for all users...')
  await setDefaultRichMenu(id)

  console.log('Done. New default rich menu:', id)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
