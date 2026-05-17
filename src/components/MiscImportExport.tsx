'use client'
import { useRef, useState } from 'react'
import { HardDriveDownload, HardDriveUpload, Paperclip } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { importMiscCsv } from '@/app/(dashboard)/misc/import-actions'

export default function MiscImportExport() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const fileRef      = useRef<HTMLInputElement>(null)
  const [busy, setBusy]     = useState(false)
  const [result, setResult] = useState<{ inserted: number; errors: { line: number; reason: string }[] } | null>(null)
  const [open, setOpen]     = useState(false)

  const exportHref = `/api/misc/export?${searchParams.toString()}`

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setResult(null)
    try {
      const text = await file.text()
      const res  = await importMiscCsv(text)
      setResult({ inserted: res.inserted, errors: res.errors })
      if (res.inserted > 0) router.refresh()
    } catch (err: any) {
      setResult({ inserted: 0, errors: [{ line: 0, reason: err?.message ?? '未知錯誤' }] })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 6 }}>
        <a href={exportHref} className="btn btn-sm" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}><HardDriveDownload size={14} /> 下載 CSV</a>
        <button className="btn btn-sm" onClick={() => { setResult(null); setOpen(true) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><HardDriveUpload size={14} /> 上傳 CSV</button>
      </div>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}
        >
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 14, width: '100%', maxWidth: 540,
            padding: '24px 24px 20px',
            display: 'flex', flexDirection: 'column', gap: 14,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>批次上傳其他收支（CSV）</div>

            <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
              <div>必要欄位：<b>日期、類型、金額</b></div>
              <div>類型可填：<b>收入</b> / <b>支出</b>（或 income / expense）</div>
              <div>選填欄位：類別、說明、備註</div>
              <div style={{ marginTop: 8 }}>建議流程：先「下載 CSV」取得當前篩選的資料作為範本，編輯後再上傳。</div>
            </div>

            <label className="btn btn-primary" style={{ cursor: busy ? 'not-allowed' : 'pointer', alignSelf: 'flex-start', opacity: busy ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Paperclip size={14} />選擇 CSV 檔案
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                disabled={busy}
                style={{ display: 'none' }}
              />
            </label>

            {busy && <div style={{ fontSize: 12, color: 'var(--text3)' }}>處理中…</div>}

            {result && (
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                <div style={{ color: result.inserted > 0 ? 'var(--accent2)' : 'var(--text2)' }}>
                  成功匯入：<b>{result.inserted}</b> 筆
                </div>
                {result.errors.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ color: 'var(--red)' }}>錯誤 {result.errors.length} 筆：</div>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0, color: 'var(--text3)' }}>
                      {result.errors.slice(0, 30).map((e, i) => (
                        <li key={i}>第 {e.line} 列：{e.reason}</li>
                      ))}
                      {result.errors.length > 30 && <li>…（其餘 {result.errors.length - 30} 筆省略）</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setOpen(false)}>關閉</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
