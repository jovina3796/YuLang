'use client'
import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 將錯誤輸出到瀏覽器 Console，方便 F12 除錯
    console.error('系統渲染錯誤：', error)
  }, [error])

  return (
    <div style={{
      padding: 40,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
    }}>
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--red)',
        borderRadius: 16,
        padding: '32px 28px',
        maxWidth: 520,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          width: 50, height: 50, borderRadius: '50%',
          background: 'rgba(255, 68, 68, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--red)',
        }}>
          <AlertTriangle size={28} />
        </div>

        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            畫面載入發生例外錯誤
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            系統在計算或讀取本頁面資料時遇到非預期的型別錯誤，為保護資料安全已暫停渲染。
          </p>
        </div>

        {/* 顯示真實錯誤原因，讓你隨時截圖立刻知道壞在哪裡 */}
        <div style={{
          background: 'var(--bg)',
          padding: '10px 14px',
          borderRadius: 8,
          width: '100%',
          textAlign: 'left',
          fontFamily: 'monospace',
          fontSize: 12,
          color: 'var(--amber2)',
          wordBreak: 'break-all',
          border: '1px solid var(--border2)',
        }}>
          錯誤原因：{error.message || '未知伺服器錯誤'}
        </div>

        <button
          onClick={reset}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4 }}
        >
          <RotateCcw size={15} /> 重新嘗試載入
        </button>
      </div>
    </div>
  )
}
