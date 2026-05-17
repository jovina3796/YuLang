'use client'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = (localStorage.getItem('theme') as 'dark' | 'light' | null) ?? 'dark'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
  }

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? '切換為淺色' : '切換為深色'}
      style={{
        width: 28, height: 28, padding: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, border: '1px solid var(--border)',
        background: 'transparent', color: 'var(--text2)',
        cursor: 'pointer',
      }}
    >
      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )
}
