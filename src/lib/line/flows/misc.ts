import { reply, flexMessage } from '@/lib/line/api'

export async function startMisc(userId: string, replyToken: string) {
  // 你剛剛申請好的 LIFF 網址
  const LIFF_URL = 'https://liff.line.me/2010109493-XfjtoucZ'

  // 設計精美的 Flex Message 報帳卡片
  const flexBubble: any = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '🧾 收支報帳系統',
          weight: 'bold',
          size: 'xl',
          color: '#ffffff'
        }
      ],
      backgroundColor: '#5E35B1', // 使用質感的深紫色來區分車趟(綠)與加油(橘)
      paddingAll: '16px'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '20px',
      contents: [
        {
          type: 'text',
          text: '請點擊下方按鈕開啟專屬報帳表單。',
          wrap: true,
          color: '#333333',
          size: 'sm',
          weight: 'bold'
        },
        {
          type: 'text',
          text: '支援項目：\n停車費、過路費、辦公用品及其他公費墊付項目，並支援單據拍照上傳。',
          wrap: true,
          color: '#8c8c8c',
          size: 'xs',
          margin: 'md'
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '16px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#5E35B1',
          action: {
            type: 'uri',
            label: '📝 開啟報帳單',
            uri: LIFF_URL
          }
        }
      ]
    }
  }

  // 將選單傳送給使用者
  await reply(replyToken, [flexMessage('開啟收支報帳選單', flexBubble)])
}
