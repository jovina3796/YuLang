'use client'
import CsvImportExport from './CsvImportExport'
import { importRateRulesCsv } from '@/app/(dashboard)/rates/actions'

export default function RateRuleImportExport() {
  return (
    <CsvImportExport
      exportHref="/api/rates/export"
      title="批次上傳運費規則（CSV）"
      importAction={importRateRulesCsv}
      hint={
        <>
          <div>必要欄位：<b>廠商、業務類別、計費方式</b></div>
          <div>計費方式：<code>flat</code> / <code>base_or_kpi</code> / <code>per_stop_count</code> / <code>pure_surcharge</code></div>
          <div>選填欄位：倉庫、地區、基本趟數、基本運費、KPI 運費、基本點數、超點費、特殊加成、加成備註、上游抽成1/2、抽成模式、季節備註、啟用、預設規則、顯示順序</div>
          <div style={{ marginTop: 4, color: 'var(--accent2)' }}>
            匹配主鍵：<b>(廠商, 倉庫, 業務類別, 地區)</b> — 相同則覆蓋更新，否則新增。
          </div>
          <div style={{ marginTop: 8 }}>建議流程：先「下載 CSV」取得目前資料作為範本，編輯後再上傳。</div>
        </>
      }
    />
  )
}
