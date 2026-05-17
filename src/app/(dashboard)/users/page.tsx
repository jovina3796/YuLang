import { redirect } from 'next/navigation'

// 使用者管理已整合到 /people（人員管理），舊路徑保留為轉址。
export default function UsersPage() {
  redirect('/people?tab=users')
}
