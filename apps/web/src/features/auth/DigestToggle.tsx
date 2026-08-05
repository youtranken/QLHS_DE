import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { apiGet, apiPost } from '../../shared/api-client'
import { t } from '../../i18n'

/**
 * F11 — the user's own switch for the 7h30 digest. Present in the topbar for the
 * DCC roles only: nobody else receives it, so offering the switch would be a lie.
 * It reads "Nhắc việc buổi sáng" rather than "opt out" — an unsubscribable robot
 * is the difference between a useful reminder and spam.
 */
export function DigestToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    void apiGet<{ enabled: boolean }>('/me/digest')
      .then((r) => alive && setEnabled(r.enabled))
      .catch(() => alive && setEnabled(null))
    return () => {
      alive = false
    }
  }, [])

  if (enabled === null) return null

  async function toggle() {
    const next = !enabled
    setBusy(true)
    setEnabled(next) // optimistic: the switch must feel instant
    try {
      await apiPost<{ enabled: boolean }>('/me/digest', { enabled: next })
    } catch {
      setEnabled(!next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={`digesttoggle${enabled ? ' on' : ''}`}
      role="switch"
      aria-checked={enabled}
      disabled={busy}
      title={enabled ? t('auth.digest.onTitle') : t('auth.digest.offTitle')}
      onClick={() => void toggle()}
    >
      {enabled ? <Bell size={14} aria-hidden /> : <BellOff size={14} aria-hidden />} <span>{t('auth.digest.label')}</span>
    </button>
  )
}
