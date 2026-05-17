'use client'
import { useState } from 'react'
import { PencilLine, Trash2, KeyRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteUser, resetUserPassword } from '@/app/(dashboard)/users/actions'
import UserFormModal, { type UserRow, type DriverOption } from './UserFormModal'

interface Props {
  user:    UserRow
  drivers: DriverOption[]
  isSelf:  boolean
}

export default function UserRowActions({ user, drivers, isSelf }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleResetPassword() {
    const pw = prompt(`重設「${user.email}」的密碼\n請輸入新密碼（至少 6 碼）`)
    if (!pw) return
    if (pw.length < 6) { alert('密碼至少 6 碼'); return }
    setBusy(true)
    const { error } = await resetUserPassword(user.id, pw)
    setBusy(false)
    if (error) { alert(`重設失敗：${error}`); return }
    alert('密碼已重設')
  }

  async function handleDelete() {
    if (!confirm(`確定刪除使用者「${user.email}」？\n此操作不可復原。`)) return
    setBusy(true)
    const { error } = await deleteUser(user.id)
    setBusy(false)
    if (error) { alert(`刪除失敗：${error}`); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      <UserFormModal
        mode="edit"
        initial={user}
        drivers={drivers}
        trigger={<button className="icon-btn" disabled={busy} title="編輯"><PencilLine size={14} /></button>}
      />
      <button className="icon-btn" onClick={handleResetPassword} disabled={busy} title="重設密碼">
        <KeyRound size={14} />
      </button>
      <button className="icon-btn danger" onClick={handleDelete} disabled={busy || isSelf}
              title={isSelf ? '不能刪除自己' : '刪除'}>
        {busy ? '…' : <Trash2 size={14} />}
      </button>
    </div>
  )
}
