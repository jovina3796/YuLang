import { NextResponse } from 'next/server';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const BASE_URL = 'https://api.line.me/v2/bot';

// 抓取環境變數中的 LIFF ID 與網址
const LIFF_FUEL = process.env.NEXT_PUBLIC_LIFF_ID;
const LIFF_TRIP = process.env.NEXT_PUBLIC_LIFF_ID_TRIP;
const LIFF_MAINTENANCE = process.env.NEXT_PUBLIC_LIFF_ID_MAINTENANCE;
const LIFF_MISC = process.env.NEXT_PUBLIC_LIFF_ID_MISC;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://yulang-erp.vercel.app/';

// 輔助函式：判斷如果有 LIFF ID 就產生 URI 動作，否則退回為一般文字訊息
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

    for (const page of pages) {
      let bottomAreas: any[] = [];
      
      // ==========================================
      // 分頁 A：司機日常 (結合 LIFF URI)
      // ==========================================
      if (page.id === 'menu-daily') {
        bottomAreas = [
          { bounds: { x: 0, y: 175, width: 625, height: 625 }, action: liffAction(LIFF_TRIP, '車趟') },
          { bounds: { x: 625, y: 175, width: 625, height: 625 }, action: liffAction(LIFF_FUEL, '加油') },
          { bounds: { x: 1250, y: 175, width: 625, height: 625 }, action: liffAction(LIFF_MAINTENANCE, '維修') },
          { bounds: { x: 1875, y: 175, width: 625, height: 625 }, action: { type: 'message', text: '選項' } }
        ];
      } 
      // ==========================================
      // 分頁 B：帳務與查詢 (文字查詢 + 報帳 LIFF)
      // ==========================================
      else if (page.id === 'menu-finance') {
        bottomAreas = [
          { bounds: { x: 0, y: 175, width: 625, height: 625 }, action: { type: 'message', text: '車趟查詢' } },
          { bounds: { x: 625, y: 175, width: 625, height: 625 }, action: { type: 'message', text: '查詢油資' } },
          { bounds: { x: 1250, y: 175, width: 625, height: 625 }, action: liffAction(LIFF_MISC, '報帳') },
          { bounds: { x: 1875, y: 175, width: 625, height: 625 }, action: { type: 'message', text: '選項' } }
        ];
      } 
      // ==========================================
      // 分頁 C：其他項目
      // ==========================================
      else {
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
          // 上方 3 個頁籤 (切換動作)
          { bounds: { x: 0, y: 0, width: 833, height: 175 }, action: { type: 'richmenuswitch', richMenuAliasId: 'menu-daily', data: 'daily' } },
          { bounds: { x: 833, y: 0, width: 834, height: 175 }, action: { type: 'richmenuswitch', richMenuAliasId: 'menu-finance', data: 'finance' } },
          { bounds: { x: 1667, y: 0, width: 833, height: 175 }, action: { type: 'richmenuswitch', richMenuAliasId: 'menu-other', data: 'other' } },
          // 下方功能區
          ...bottomAreas
        ]
      };

      const { data } = await axios.post(`${BASE_URL}/richmenu`, richMenu, { headers: { Authorization: `Bearer ${TOKEN}` } });
      const richMenuId = data.richMenuId;

      const imagePath = path.join(process.cwd(), 'img', page.file);
      const imageBuffer = fs.readFileSync(imagePath);
      await axios.post(`${BASE_URL}/richmenu/${richMenuId}/content`, imageBuffer, { 
        headers: { 
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'image/png' 
        } 
      });

      await axios.post(`${BASE_URL}/richmenu/alias`, { richMenuId, richMenuAliasId: page.id }, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
    }

    await axios.post(`${BASE_URL}/user/all/richmenu/menu-daily`, {}, { headers: { Authorization: `Bearer ${TOKEN}` } });

    return NextResponse.json({ message: '🎉 太棒了！所有分頁圖文選單 (包含 LIFF 連結) 已成功安裝至 LINE 官方帳號！' });
  } catch (error: any) {
    console.error('Setup Error:', error.response?.data || error.message);
    return NextResponse.json({ error: error.response?.data ?? error.message }, { status: 500 });
  }
}
