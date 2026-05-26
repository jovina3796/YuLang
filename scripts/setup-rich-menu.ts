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
const COL_W = 625

// Layout (matches the artwork at img/馭浪圖文選單.png):
//   col0 / col1 / col2 (full height 843)  + col3 split into 3 rows: 220 / 220 / 403
const COL3_X = COL_W * 3
const ROW_A_H = 220
const ROW_B_H = 220
const ROW_C_H = HEIGHT - ROW_A_H - ROW_B_H // 403

type Cell = {
  label: string
  bg: string
  fg: string
  bounds: { x: number; y: number; width: number; height: number }
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

function msg(label: string, text: string): RichMenuArea['action'] {
  return { type: 'message', label, text }
}

const CELLS: Cell[] = [
  // Column 0–2: full-height entry buttons
  {
    label: '加油紀錄', bg: '#0EA5E9', fg: '#FFFFFF',
    bounds: { x: 0,        y: 0, width: COL_W, height: HEIGHT },
    action: liffUri(LIFF_FUEL, '加油'),
  },
  {
    label: '車趟紀錄', bg: '#10B981', fg: '#FFFFFF',
    bounds: { x: COL_W,    y: 0, width: COL_W, height: HEIGHT },
    action: liffUri(LIFF_TRIP, '車趟'),
  },
  {
    label: '維修保養', bg: '#F59E0B', fg: '#FFFFFF',
    bounds: { x: COL_W * 2, y: 0, width: COL_W, height: HEIGHT },
    action: liffUri(LIFF_MAINTENANCE, '維修'),
  },
  // Column 3: three stacked tiles (車趟查詢 / 加油查詢 / ERP網頁)
  {
    label: '車趟查詢', bg: '#6366F1', fg: '#FFFFFF',
    bounds: { x: COL3_X, y: 0, width: COL_W, height: ROW_A_H },
    action: msg('車趟查詢', '查詢車趟'),
  },
  {
    label: '加油查詢', bg: '#8B5CF6', fg: '#FFFFFF',
    bounds: { x: COL3_X, y: ROW_A_H, width: COL_W, height: ROW_B_H },
    action: msg('加油查詢', '查詢油資'),
  },
  {
    label: 'ERP網頁', bg: '#475569', fg: '#FFFFFF',
    bounds: { x: COL3_X, y: ROW_A_H + ROW_B_H, width: COL_W, height: ROW_C_H },
    action: { type: 'uri', label: 'ERP網頁', uri: SITE_URL },
  },
]

const CUSTOM_IMAGE_PATH = resolve(process.cwd(), 'img/馭浪圖文選單.png')

function buildSvg(): string {
  const blocks = CELLS.map(c => {
    const { x, y, width, height } = c.bounds
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${c.bg}"/>` +
           `<text x="${x + width / 2}" y="${y + height / 2}" font-family="Microsoft JhengHei, PingFang TC, Heiti TC, Noto Sans CJK TC, sans-serif" font-size="120" font-weight="700" fill="${c.fg}" text-anchor="middle" dominant-baseline="central">${c.label}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">${blocks}</svg>`
}

async function loadPng(): Promise<Buffer> {
  try {
    const buf = readFileSync(CUSTOM_IMAGE_PATH)
    // Validate size matches the menu's declared dimensions.
    const meta = await sharp(buf).metadata()
    if (meta.width !== WIDTH || meta.height !== HEIGHT) {
      throw new Error(`custom image ${meta.width}x${meta.height} != ${WIDTH}x${HEIGHT}`)
    }
    console.log(`Using custom design: ${CUSTOM_IMAGE_PATH}`)
    // Ensure output is PNG even if source is something else.
    return meta.format === 'png' ? buf : sharp(buf).png({ compressionLevel: 9 }).toBuffer()
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('Custom image not found, generating placeholder PNG via sharp...')
      return sharp(Buffer.from(buildSvg())).png({ compressionLevel: 9 }).toBuffer()
    }
    throw e
  }
}

async function main(): Promise<void> {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN missing in env (.env.local).')
    process.exit(1)
  }

  console.log('Loading rich menu PNG...')
  const png = await loadPng()
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
    areas: CELLS.map(c => ({
      bounds: c.bounds,
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
