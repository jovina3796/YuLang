import { redirect } from 'next/navigation'

// 付款別名已整合到加油紀錄頁，舊路徑保留為轉址。
export default function PaymentAliasesPage() {
  redirect('/fuel')
}
