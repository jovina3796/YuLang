import { createServiceClient } from '@/lib/supabase/service'
import PaymentAliasFormModal from '@/components/PaymentAliasFormModal'
import PaymentAliasRowActions from '@/components/PaymentAliasRowActions'

export default async function PaymentAliasesPage() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('payment_aliases')
    .select('id, alias, target, created_at')
    .order('created_at', { ascending: false })
  const rows = data ?? []

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>付款別名</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          司機在 LINE 加油回報輸入的關鍵字 → 對應寫入資料庫的付款方式。最長關鍵字優先比對。
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <PaymentAliasFormModal mode="create" />
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">別名清單</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>關鍵字</th>
              <th style={{ textAlign: 'left' }}>對應付款方式</th>
              <th style={{ width: 80, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>尚無資料</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td style={{ textAlign: 'left' }}>{r.alias}</td>
                <td style={{ textAlign: 'left' }}>{r.target}</td>
                <td style={{ textAlign: 'right' }}>
                  <PaymentAliasRowActions row={{ id: r.id, alias: r.alias, target: r.target }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
