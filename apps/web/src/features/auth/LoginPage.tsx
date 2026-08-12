import { useState, type FormEvent } from 'react'
import { apiPost, ApiClientError } from '../../shared/api-client'
import { t } from '../../i18n'

/** Minimal email shape — decides the branch: an email goes to SSO, anything else
 *  (a break-glass username like "admin.ssa") takes the local password path. */
function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

/**
 * One door (QLTS parity). The user types an identifier and continues:
 *  - an **email** → hand off to PMH ID (carried as `login_hint`); the password is
 *    entered THERE, never on QLHS.
 *  - a non-email **username** → reveal a password box and try the local
 *    break-glass SA (`/auth/local-login`).
 * The branch is decided client-side (no server probe) so we never leak whether an
 * address exists. `goSso` is injected so the redirect is testable in jsdom.
 */
export function LoginPage({
  onLoggedIn,
  goSso = (loginHint: string) => {
    const q = loginHint ? `?login_hint=${encodeURIComponent(loginHint)}` : ''
    window.location.href = `/api/auth/login${q}`
  },
}: {
  onLoggedIn: () => void
  goSso?: (loginHint: string) => void
}) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [step, setStep] = useState<'id' | 'password'>('id')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Session-expiry landing (FR #3): api-client redirects here with ?expired=1.
  const [sessionExpired] = useState(
    () => new URLSearchParams(window.location.search).get('expired') === '1',
  )

  function onContinue(e: FormEvent) {
    e.preventDefault()
    const id = identifier.trim()
    if (!id) return
    setError(null)
    if (isEmail(id)) {
      setBusy(true) // stay busy through the redirect — no flash of the password step
      goSso(id)
      return
    }
    // Not an email → break-glass local SA username path.
    setStep('password')
  }

  async function onSignIn(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await apiPost('/auth/local-login', { username: identifier.trim(), password })
      onLoggedIn()
    } catch (err) {
      // 429 = brute-force lockout (per-IP): tell the user to wait, not "wrong
      // password" — the credentials were never checked on a locked attempt.
      const locked = err instanceof ApiClientError && err.status === 429
      setError(t(locked ? 'auth.login.tooManyAttempts' : 'auth.login.badCredentials'))
    } finally {
      setBusy(false)
    }
  }

  function backToId() {
    setStep('id')
    setPassword('')
    setError(null)
  }

  if (step === 'password') {
    return (
      <form className="localform" onSubmit={onSignIn} noValidate>
        <div className="idrow">
          <span className="idlabel">{t('auth.login.signingInAs')}</span>
          <span className="idemail">{identifier}</span>
          <button type="button" className="linkbtn" onClick={backToId} disabled={busy}>
            {t('auth.login.changeEmail')}
          </button>
        </div>
        <div className="field">
          <label htmlFor="lp-pass">{t('auth.login.passwordLabel')}</label>
          <div className="field-inp">
            <svg className="field-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <input
              id="lp-pass"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
            <button
              type="button"
              className="pw-eye"
              aria-label={showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {error && (
            <span role="alert" className="err">
              {error}
            </span>
          )}
        </div>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? t('auth.login.signingIn') : t('auth.login.signIn')}
        </button>
      </form>
    )
  }

  return (
    <form className="localform" onSubmit={onContinue} noValidate>
      {sessionExpired && !error && (
        <p role="status" className="login-notice">
          {t('auth.login.sessionExpired')}
        </p>
      )}
      <div className="field">
        <label htmlFor="lp-id">{t('auth.login.emailLabel')}</label>
        <div className="field-inp">
          <svg className="field-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
          <input
            id="lp-id"
            type="text"
            placeholder={t('auth.login.emailPlaceholder')}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </div>
        {error && (
          <span role="alert" className="err">
            {error}
          </span>
        )}
      </div>
      <button className="btn primary" type="submit" disabled={busy || identifier.trim() === ''}>
        {busy ? t('auth.login.checking') : t('auth.login.continue')}
      </button>
    </form>
  )
}
