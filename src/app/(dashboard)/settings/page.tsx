import SettingsForm from '@/components/SettingsForm'
import { getCurrentProfile } from '@/lib/auth'

export default async function SettingsPage() {
  const profile = await getCurrentProfile()
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>系統設定</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>個人化偏好設定，自訂主題色彩會儲存至帳號</div>
      </div>
      <SettingsForm initialTheme={profile?.theme ?? null} />
    </div>
  )
}
