import { redirect } from 'next/navigation'

export default function MiscRedirect() {
  redirect('/finance?tab=misc')
}
