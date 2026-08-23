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
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.2 6.2 7.6 7.6M16.4 16.4l1.4 1.4M17.8 6.2 16.4 7.6M7.6 16.4 6.2 17.8" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 7.4 7.4 0 1 0 20 14.5Z" />
        </svg>
      )}
    </button>
  )
}
