import { useState } from 'react'
import { getStoredTheme, toggleTheme } from '../lib/theme'

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => getStoredTheme())
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(toggleTheme())}
      aria-label={isDark ? '라이트 모드' : '다크 모드'}
    >
      {isDark ? '☀' : '☾'}
    </button>
  )
}
