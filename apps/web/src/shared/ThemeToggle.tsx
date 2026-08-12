import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { t } from '../i18n'

/** Light is default; dark is a peer. Persists to localStorage, flips data-theme
 *  on <html> (main.tsx sets it before first paint). */
export function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'light')

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light'
    document.documentElement.dataset.theme = next
    localStorage.setItem('qlhs-theme', next)
    setTheme(next)
  }

  return (
    <button type="button" className="themebtn" onClick={toggle} aria-label={t('shell.themeToggle.aria')}>
      {theme === 'light' ? (
        <>
          <Moon size={14} aria-hidden /> {t('shell.themeToggle.toDark')}
        </>
      ) : (
        <>
          <Sun size={14} aria-hidden /> {t('shell.themeToggle.toLight')}
        </>
      )}
    </button>
  )
}
