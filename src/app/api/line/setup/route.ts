import { NextResponse } from 'next/server';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const BASE_URL = 'https://api.line.me/v2/bot';
const DATA_URL = 'https://api-data.line.me/v2/bot';

const LIFF_FUEL = process.env.NEXT_PUBLIC_LIFF_ID;
const LIFF_TRIP = process.env.NEXT_PUBLIC_LIFF_ID_TRIP;
const LIFF_MAINTENANCE = process.env.NEXT_PUBLIC_LIFF_ID_MAINTENANCE;
const LIFF_MISC = process.env.NEXT_PUBLIC_LIFF_ID_MISC;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://yulang-erp.vercel.app/';

function liffAction(id: string | undefined, fallbackText: string) {
  if (id) {
    return { type: 'uri', label: fallbackText, uri: `https://liff.line.me/${id}` };
  }
  return { type: 'message', label: fallbackText, text: fallbackText };
}

export async function GET() {
  try {
    const pages = [
      { id: 'menu-daily', file: 'menu-daily.png', name: '司機日常' },
      { id: 'menu-finance', file: 'menu-finance.png', name: '帳務與查詢' },
      { id: 'menu-other', file: 'menu-other.png', name: '其他項目' }
    ];

    let defaultMenuId = ''; // 🌟 準備一個變數來儲存真正的 LINE ID

    for (const page of pages) {
      let bottomAreas: any[] = [];
      
      if (page.id === 'menu-daily') {
        bottomAreas = [
          { bounds: { x: 0, y: 175, width: 625, height: 625 }, action: liffAction(LIFF_TRIP, '車趟') },
          { bounds: { x: 625, y: 175, width: 625, height: 625 }, action: liffAction(LIFF_FUEL, '加油') },
          { bounds: { x: 1250, y: 175, width: 625, height: 625 }, action: liffAction(LIFF_MAINTENANCE, '維修') },
          { bounds: { x: 1875, y: 175, width: 625, height: 625 }, action: { type: 'message', text: '選項' } }
        ];
      } else if (page.id === 'menu-finance') {
        bottomAreas = [
          { bounds: { x: 0, y: 175, width: 625, height: 625 }, action: { type: 'message', text: '車趟查詢' } },
          { bounds: { x: 625, y: 175, width: 625, height: 625 }, action: { type: 'message', text: '查詢油資' } },
          { bounds: { x: 1250, y: 175, width: 625, height: 625 }, action: liffAction(LIFF_MISC, '報帳') },
          { bounds: { x: 1875, y: 175, width: 625, height: 625 }, action: { type: 'message', text: '選項' } }
        ];
      } else {
        bottomAreas = [
          { bounds: { x: 0, y: 175, width: 625, height: 625 }, action: { type: 'message', text: '註冊' } },
          { bounds: { x: 625, y: 175, width: 625, height: 625 }, action: { type: 'message', text: '選項' } },
          { bounds: { x: 1250, y: 175, width: 1250, height: 625 }, action: { type: 'uri', label: 'ERP網頁', uri: SITE_URL } }
        ];
      }

      const richMenu = {
        size: { width: 2500, height: 800 },
        selected: page.id === 'menu-daily',
        name: page.name,
        chatBarText: '開啟選單',
        areas: [
          { bounds: { x: 0, y: 0, width: 833, height: 175 }, action: { type: 'richmenuswitch', richMenuAliasId: 'menu-daily', data: 'daily' } },
          { bounds: { x: 833, y: 0, width: 834, height: 175 }, action: { type: 'richmenuswitch', richMenuAliasId: 'menu-finance', data: 'finance' } },
          { bounds: { x: 1667, y: 0, width: 833, height: 175 }, action: { type: 'richmenuswitch', richMenuAliasId: 'menu-other', data: 'other' } },
          ...bottomAreas
        ]
      };

      // 1. 建立選單框架，並把 LINE 產生的真實 ID 存起來
      const { data } = await axios.post(`${BASE_URL}/richmenu`, richMenu, { headers: { Authorization: `Bearer ${TOKEN}` } });
      const richMenuId = data.richMenuId;

      // 🌟 如果是日常選單，把真實 ID 記下來，最後設定預設選單會用到
      if (page.id === 'menu-daily') {
        defaultMenuId = richMenuId;
      }

      // 2. 上傳圖片 
      const imagePath = path.join(process.cwd(), 'img', page.file);
      const imageBuffer = fs.readFileSync(imagePath);
      await axios.post(`${DATA_URL}/richmenu/${richMenuId}/content`, imageBuffer, { 
        headers: { 
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'image/png' 
        } 
      });

      // 3. 防呆機制：先刪除舊的 Alias (如果有)，避免重複報錯
      try {
        await axios.delete(`${BASE_URL}/richmenu/alias/${page.id}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
      } catch (e) {
        // 找不到舊的 Alias 就忽略
      }

      // 4. 重新綁定 Alias
      await axios.post(`${BASE_URL}/richmenu/alias`, { richMenuId, richMenuAliasId: page.id }, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
    }

    // 5. 🌟 用正確的「真實 ID」來設定預設選單
    if (defaultMenuId) {
      await axios.post(`${BASE_URL}/user/all/richmenu/${defaultMenuId}`, {}, { headers: { Authorization: `Bearer ${TOKEN}` } });
    }

    return NextResponse.json({ message: '🎉 太棒了！所有分頁圖文選單已成功安裝至 LINE 官方帳號！' });
  } catch (error: any) {
    console.error('Setup Error:', error.response?.data || error.message);
    return NextResponse.json({ error: error.response?.data ?? error.message }, { status: 500 });
  }
}
