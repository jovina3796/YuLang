'use client'
import CsvImportExport from './CsvImportExport'
import { importSubroutesCsv } from '@/app/(dashboard)/vendor-info/subroutes/import-actions'

export default function SubrouteImportExport() {
  return (
    <CsvImportExport
      exportHref="/api/subroutes/export"
      title="批次上傳配送區域對應（CSV）"
      importAction={importSubroutesCsv}
      hint={
        <>
          <div>必要欄位：<b>配送區域、地區</b></div>
          <div>已存在的「配送區域」會以新值覆蓋；未存在則新增。</div>
          <div style={{ marginTop: 8 }}>建議流程：先「下載 CSV」取得目前資料作為範本，編輯後再上傳。</div>
        </>
      }
    />
  )
}
