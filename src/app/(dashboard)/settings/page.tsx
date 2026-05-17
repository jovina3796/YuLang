import SettingsForm from '@/components/SettingsForm'

export default function SettingsPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>系統設定</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>個人化偏好設定，儲存於本機瀏覽器</div>
      </div>
      <SettingsForm />
    </div>
  )
}
