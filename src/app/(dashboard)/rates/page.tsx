import { redirect } from 'next/navigation'

export default function RatesRedirect() {
  redirect('/vendor-info?tab=rates')
}
