import { redirect } from 'next/navigation'

export default function FixedRedirect() {
  redirect('/finance?tab=fixed')
}
