import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { t } from '../i18n'

/** Dark is default; light is a peer. Persists to localStorage, flips data-theme
 *  on <html> (EXPERIENCE §Foundation). */
export function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'dark')

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
