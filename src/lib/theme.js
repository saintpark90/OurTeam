const THEME_STORAGE_KEY = 'ourteam-theme'

export const getStoredTheme = () => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return 'dark'
}

export const applyTheme = (theme) => {
  const next = theme === 'light' ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    /* ignore */
  }
  return next
}

export const initTheme = () => {
  applyTheme(getStoredTheme())
}

export const toggleTheme = () => {
  const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  return applyTheme(current === 'dark' ? 'light' : 'dark')
}
