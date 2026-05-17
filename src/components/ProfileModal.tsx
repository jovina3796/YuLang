'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, X } from 'lucide-react'
import { uploadMyAvatar, updateMyProfile, changeMyPassword } from '@/app/(dashboard)/profile/actions'

interface Props {
  open: boolean
  onClose: () => void
  me: {
    id:           string
    email:        string | null
    role:         'admin' | 'driver'
    display_name: string | null
    avatar_url:   string | null
  }
}

export default function ProfileModal({ open, onClose, me }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [displayName, setDisplayName] = useState(me.display_name ?? '')
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(me.avatar_url)
  const [uploading,   setUploading]   = useState(false)
  const [saving,      setSaving]      = useState(false)

  const [currentPw,   setCurrentPw]   = useState('')
  const [newPw,       setNewPw]       = useState('')
  const [confirmPw,   setConfirmPw]   = useState('')
  const [pwSaving,    setPwSaving]    = useState(false)

  if (!open) return null

  async function handlePickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    setUploading(true)
    const { url, error } = await uploadMyAvatar(fd)
    setUploading(false)
    if (error) { alert(`上傳失敗：${error}`); return }
    setAvatarUrl(url)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSaveProfile() {
    setSaving(true)
    const { error } = await updateMyProfile({
      display_name: displayName.trim() || null,
      avatar_url:   avatarUrl,
    })
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    router.refresh()
    onClose()
  }

  async function handleChangePassword() {
    if (!currentPw) { alert('請輸入目前密碼'); return }
    if (newPw.length < 6) { alert('新密碼至少 6 碼'); return }
    if (newPw !== confirmPw) { alert('兩次新密碼輸入不一致'); return }
    setPwSaving(true)
    const { error } = await changeMyPassword(currentPw, newPw)
    setPwSaving(false)
    if (error) { alert(`變更失敗：${error}`); return }
    setCurrentPw(''); setNewPw(''); setConfirmPw('')
    alert('密碼已更新')
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }
  const G2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

  const fallbackChar = (displayName || me.email || 'U').trim().charAt(0).toUpperCase() || 'U'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 14, width: '100%', maxWidth: 520,
        padding: '28px 28px 24px',
        display: 'flex', flexDirection: 'column', gap: 16,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>個人資料</div>
          <button className="icon-btn" onClick={onClose} title="關閉"><X size={14} /></button>
        </div>

        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--bg4)', border: '1px solid var(--border2)',
            overflow: 'hidden', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 28, color: 'var(--text2)', flexShrink: 0,
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : fallbackChar}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePickAvatar}
                   style={{ display: 'none' }} />
            <button className="btn" disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Camera size={14} /> {uploading ? '上傳中…' : '更換大頭貼'}
            </button>
            {avatarUrl && (
              <button className="btn" disabled={uploading} onClick={() => setAvatarUrl(null)}
                      style={{ fontSize: 12 }}>移除大頭貼</button>
            )}
          </div>
        </div>

        <label style={L}>
          <span style={LT}>顯示名稱</span>
          <input type="text" className="input" value={displayName}
                 onChange={e => setDisplayName(e.target.value)} placeholder="例：王小明" />
        </label>

        <div style={G2}>
          <label style={L}>
            <span style={LT}>E-Mail（聯絡管理員修改）</span>
            <input type="text" className="input" value={me.email ?? ''} disabled
                   style={{ opacity: .7, cursor: 'not-allowed' }} />
          </label>
          <label style={L}>
            <span style={LT}>角色</span>
            <input type="text" className="input"
                   value={me.role === 'admin' ? '管理員' : '司機'} disabled
                   style={{ opacity: .7, cursor: 'not-allowed' }} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" disabled={saving} onClick={handleSaveProfile}>
            {saving ? '儲存中…' : '儲存資料'}
          </button>
        </div>

        {/* Password change */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 10, textAlign: 'left' }}>
            變更密碼
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={L}>
              <span style={LT}>目前密碼</span>
              <input type="password" className="input" value={currentPw}
                     onChange={e => setCurrentPw(e.target.value)} autoComplete="current-password" />
            </label>
            <div style={G2}>
              <label style={L}>
                <span style={LT}>新密碼（至少 6 碼）</span>
                <input type="password" className="input" value={newPw}
                       onChange={e => setNewPw(e.target.value)} autoComplete="new-password" />
              </label>
              <label style={L}>
                <span style={LT}>確認新密碼</span>
                <input type="password" className="input" value={confirmPw}
                       onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary"
                      disabled={pwSaving || !currentPw || !newPw || !confirmPw}
                      onClick={handleChangePassword}>
                {pwSaving ? '更新中…' : '更新密碼'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
