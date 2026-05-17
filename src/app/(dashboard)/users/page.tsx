import { redirect } from 'next/navigation'

// 使用者管理已整合到 /people/users，舊路徑保留為轉址。
export default function UsersPage() {
  redirect('/people/users')
}
