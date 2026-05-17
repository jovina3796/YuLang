import { redirect } from 'next/navigation'

export default function VendorsRedirect() {
  redirect('/vendor-info?tab=vendors')
}
