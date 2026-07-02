import { reply, flexMessage } from '@/lib/line/api'

export async function sendMainMenu(replyToken: string) {
  const carousel: any = {
    type: 'carousel',
    contents: [
      createMenuCard('🚗 車趟回報', '#2E7D32', '回報每日運送趟次與站點', '回報車趟', '車趟'),
      createMenuCard('⛽ 加油回報', '#E65100', '紀錄加油公升數與金額', '回報加油', '加油'),
      createMenuCard('🔧 維修保養', '#1565C0', '車輛保養與維修紀錄', '回報維修', '維修'),
      createMenuCard('🧾 金流報帳', '#5E35B1', '停車、過路費等支出', '新增報帳', '報帳'),
      createMenuCard('📊 車趟查詢', '#424242', '查詢本月車趟與運費', '查詢當月車趟', '車趟查詢')
    ]
  }

  await reply(replyToken, [flexMessage('系統主選單', carousel)])
}

// 輔助函式：用來快速生成統一風格的卡片
function createMenuCard(title: string, color: string, desc: string, buttonLabel: string, actionText: string) {
  return {
    type: 'bubble',
    size: 'small', // small 尺寸在手機上可以一次看到約 2.5 張卡片，非常適合輪播
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: color,
      paddingAll: '12px',
      contents: [
        {
          type: 'text',
          text: title,
          color: '#ffffff',
          weight: 'bold',
          size: 'md'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      contents: [
        {
          type: 'text',
          text: desc,
          size: 'sm',
          color: '#666666',
          wrap: true
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: color,
          action: {
            // 重點：當使用者點擊按鈕時，形同在對話框輸入這段文字
            type: 'message',
            label: buttonLabel,
            text: actionText
          }
        }
      ]
    }
  }
}
