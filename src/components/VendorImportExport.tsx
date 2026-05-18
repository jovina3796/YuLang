'use client'
import CsvImportExport from './CsvImportExport'
import { importVendorsCsv } from '@/app/(dashboard)/vendors/actions'

export default function VendorImportExport() {
  return (
    <CsvImportExport
      exportHref="/api/vendors/export"
      title="批次上傳廠商（CSV）"
      importAction={importVendorsCsv}
      hint={
        <>
          <div>必要欄位：<b>廠商名稱</b></div>
          <div>選填欄位：倉庫、聯絡人、電話、付款條件、計費起算日、延後月數、顯示順序</div>
          <div style={{ marginTop: 4, color: 'var(--accent2)' }}>
            匹配主鍵：<b>(廠商名稱, 倉庫)</b> — 兩者組合相同則覆蓋更新，否則新增。
          </div>
          <div style={{ marginTop: 8 }}>建議流程：先「下載 CSV」取得目前資料作為範本，編輯後再上傳。</div>
        </>
      }
    />
  )
}
