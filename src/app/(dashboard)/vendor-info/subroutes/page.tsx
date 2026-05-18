import { createServiceClient } from '@/lib/supabase/service'
import SubrouteAliasFormModal from '@/components/SubrouteAliasFormModal'
import SubrouteAliasRowActions from '@/components/SubrouteAliasRowActions'
import SubrouteImportExport from '@/components/SubrouteImportExport'
import SortableTh from '@/components/SortableTh'

export default async function SubroutesTabPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>
}) {
  const sp = await searchParams
  const sortField = sp.sort ?? 'billing_area'
  const ascending = (sp.dir ?? 'asc') === 'asc'

  const supabase = createServiceClient()
  const [{ data: aliases }, { data: rules }] = await Promise.all([
    supabase.from('subroute_aliases').select('alias, billing_area, updated_at').order('alias'),
    supabase.from('vendor_rate_rules').select('destination_area').not('destination_area', 'is', null),
  ])

  const billingAreaOptions = Array.from(new Set(
    (rules ?? []).map(r => r.destination_area).filter((s): s is string => !!s)
  )).sort((a, b) => a.localeCompare(b, 'zh-Hant'))

  const sorted = [...(aliases ?? [])].sort((a, b) => {
    const av = sortField === 'alias' ? a.alias : a.billing_area
    const bv = sortField === 'alias' ? b.alias : b.billing_area
    const cmp = String(av).localeCompare(String(bv), 'zh-Hant')
    return ascending ? cmp : -cmp
  })

  // Group by billing_area for visual readability when sorted by it
  const grouped: Record<string, typeof sorted> = {}
  if (sortField === 'billing_area') {
    sorted.forEach(a => {
      if (!grouped[a.billing_area]) grouped[a.billing_area] = []
      grouped[a.billing_area]!.push(a)
    })
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        <SubrouteImportExport />
        <SubrouteAliasFormModal mode="create" billingAreas={billingAreaOptions} />
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">配送區域對應</div>
            <div className="card-sub">司機 LINE 純文字回報用，共 {sorted.length} 筆</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <SortableTh field="alias" defaultField="billing_area" defaultDir="asc">配送區域（司機輸入）</SortableTh>
              <SortableTh field="billing_area" defaultField="billing_area" defaultDir="asc">計價區域</SortableTh>
              <th style={{ width: 80, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!sorted.length ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>尚無資料</td></tr>
            ) : sortField === 'billing_area' ? (
              Object.entries(grouped).map(([area, list]) => (
                list.map((a, i) => (
                  <tr key={a.alias}>
                    <td className="name">{a.alias}</td>
                    <td>
                      {i === 0 && <span className="badge badge-blue">{area}</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <SubrouteAliasRowActions
                        row={{ alias: a.alias, billing_area: a.billing_area }}
                        billingAreas={billingAreaOptions}
                      />
                    </td>
                  </tr>
                ))
              )).flat()
            ) : (
              sorted.map(a => (
                <tr key={a.alias}>
                  <td className="name">{a.alias}</td>
                  <td><span className="badge badge-blue">{a.billing_area}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <SubrouteAliasRowActions
                      row={{ alias: a.alias, billing_area: a.billing_area }}
                      billingAreas={billingAreaOptions}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
