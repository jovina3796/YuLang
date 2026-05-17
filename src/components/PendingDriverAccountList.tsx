'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, AlertCircle } from 'lucide-react'
import { createUserForDriver, deriveDriverCredentials } from '@/app/(dashboard)/users/actions'

export type PendingDriver = {
  id:          string
  name:        string
  employee_no: string | null
  phone:       string | null
}

interface Props {
  drivers: PendingDriver[]
}

export default function PendingDriverAccountList({ drivers }: Props) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  if (!drivers.length) return null

  async function handleCreate(d: PendingDriver) {
    const cred = deriveDriverCredentials(d.phone)
    if (!cred) {
      alert(`「${d.name}」沒有手機號碼，無法自動建立帳號。請先補登手機後再試。`)
      return
    }
    if (!confirm(
      `為「${d.name}」建立登入帳號？\n\nE-Mail：${cred.email}\n用戶名：${cred.username}\n預設密碼：${cred.password}\n\n建立後請轉告司機並提醒首次登入修改密碼。`,
    )) return
    setBusyId(d.id)
    const r = await createUserForDriver(d.id)
    setBusyId(null)
    if (r.error) { alert(`建立失敗：${r.error}`); return }
    if (r.skipped) {
      alert(`已略過：${r.reason === 'no-phone' ? '無手機' :
                       r.reason === 'email-exists' ? '對應 E-Mail 已存在' :
                       '已有對應帳號'}`)
    }
    router.refresh()
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <div>
          <div className="card-title">未建立帳號的司機</div>
          <div className="card-sub">點擊「建立帳號」自動以手機號碼產生 E-Mail 與預設密碼</div>
        </div>
      </div>
      <div>
        {drivers.map(d => {
          const cred = deriveDriverCredentials(d.phone)
          const noPhone = !cred
          return (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="name" style={{ fontSize: 13 }}>{d.name}</span>
                  {d.employee_no && (
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{d.employee_no}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontFamily: 'var(--mono)' }}>
                  {noPhone ? (
                    <span style={{ color: 'var(--amber2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={11} /> 缺手機 → 無法自動建立
                    </span>
                  ) : (
                    <>{cred.email}　|　密碼：{cred.password}</>
                  )}
                </div>
              </div>
              <button
                className="btn btn-sm"
                disabled={noPhone || busyId === d.id}
                onClick={() => handleCreate(d)}
                title={noPhone ? '需先補登手機' : '建立帳號'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <UserPlus size={12} /> {busyId === d.id ? '建立中…' : '建立帳號'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
