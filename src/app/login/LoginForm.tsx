'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { CircleArrowRight } from 'lucide-react'
import { signIn } from './actions'

const BG = '#5a6274'
const FIELD_BG = '#c8ced8'
const TEXT = '#ffffff'

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    fd.append('email', email)
    fd.append('password', password)
    startTransition(async () => {
      const { error } = await signIn(fd)
      if (error) { setError(error); return }
      router.replace('/dashboard')
      router.refresh()
    })
  }

  function handleForgotPassword() {
    alert('忘記密碼請聯絡系統管理員協助重設。')
  }

  return (
    <>
      <style>{`
        .login-page { min-height: 100vh; background: ${BG}; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .login-wrap { width: 100%; max-width: 980px; display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 40px; }
        .login-shark { display: flex; justify-content: center; align-items: center; }
        .login-shark img { width: 100%; max-width: 380px; height: auto; }
        .login-right { display: flex; flex-direction: column; gap: 28px; align-items: flex-start; }
        .login-wordmark { width: 100%; max-width: 360px; height: auto; }
        .login-form { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 360px; }
        .login-label { display: flex; flex-direction: column; gap: 6px; }
        .login-label > span { font-size: 13px; color: ${TEXT}; letter-spacing: 1px; }
        .login-input { background: ${FIELD_BG}; border: none; border-radius: 4px; padding: 8px 12px; font-size: 14px; color: #1f2630; outline: none; height: 32px; }
        .login-error { font-size: 12px; color: #fff; background: rgba(220,80,80,.25); border: 1px solid rgba(255,180,180,.35); border-radius: 6px; padding: 8px 12px; }
        .login-actions { display: flex; align-items: center; gap: 16px; margin-top: 8px; }
        .login-btn { display: inline-flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 10px 8px 28px; border-radius: 999px; border: 1.5px solid #fff; background: transparent; color: #fff; font-size: 14px; letter-spacing: 4px; cursor: pointer; min-width: 170px; transition: all .15s; }
        .login-btn:disabled { opacity: .55; cursor: not-allowed; }
        .login-btn-circle { width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; line-height: 1; font-weight: 600; padding-bottom: 3px; }
        .login-forgot { background: transparent; border: none; cursor: pointer; padding: 4px; opacity: .85; display: inline-flex; align-items: center; }
        .login-forgot:hover { opacity: 1; }

        @media (max-width: 720px) {
          .login-wrap { grid-template-columns: 1fr; gap: 20px; max-width: 380px; }
          .login-shark { flex-direction: column; gap: 12px; }
          .login-shark img { max-width: 160px; }
          .login-right { align-items: center; }
          .login-wordmark { max-width: 280px; }
          .login-form { align-items: stretch; }
          .login-actions { justify-content: center; }
        }
      `}</style>

      <div className="login-page">
        <div className="login-wrap">
          {/* Left: shark mascot */}
          <div className="login-shark">
            <Image src="/login-shark.png" alt="馭浪物流" width={420} height={420} priority />
          </div>

          {/* Right: wordmark + form */}
          <div className="login-right">
            <Image
              className="login-wordmark"
              src="/login-wordmark.png"
              alt="馭浪物流 Yulang Logistics Ltd."
              width={720}
              height={320}
              priority
            />

            <form onSubmit={handleSubmit} className="login-form">
              <label className="login-label">
                <span>帳號（用戶名或 E-Mail）</span>
                <input
                  type="text" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="username" autoFocus
                  className="login-input"
                />
              </label>

              <label className="login-label">
                <span>密碼</span>
                <input
                  type="password" required value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="login-input"
                />
              </label>

              {error && <div className="login-error">{error}</div>}

              <div className="login-actions">
                <button type="submit" className="login-btn"
                        disabled={pending || !email || !password}>
                  <span style={{ fontWeight: 600 }}>{pending ? 'LOADING' : 'LOGIN'}</span>
                  <CircleArrowRight size={28} strokeWidth={1.6} aria-hidden />
                </button>

                <button type="button" className="login-forgot"
                        onClick={handleForgotPassword} title="忘記密碼">
                  <Image src="/icon-forgot-password.png" alt="忘記密碼" width={36} height={36} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
