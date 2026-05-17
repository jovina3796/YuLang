import { redirect } from 'next/navigation'

// 司機資料已整合到 /people（人員管理），舊路徑保留為轉址。
export default function DriversPage() {
  redirect('/people?tab=drivers')
}
