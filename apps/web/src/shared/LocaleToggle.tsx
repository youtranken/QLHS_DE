import { currentLocale, switchLocale, type Locale } from '../i18n/locale'
import { t } from '../i18n'

const OPTS: Locale[] = ['vi', 'en']

/** VI / EN segmented switch. Persists + reloads so the whole tree re-renders
 *  from the chosen catalog (same reload approach as the theme). */
export function LocaleToggle() {
  const loc = currentLocale()
  return (
    <div className="localetoggle" role="group" aria-label={t('shell.localeToggle.aria')}>
      {OPTS.map((o) => (
        <button
          key={o}
          type="button"
          className={loc === o ? 'on' : ''}
          aria-pressed={loc === o}
          onClick={() => loc !== o && switchLocale(o)}
        >
          {o.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
