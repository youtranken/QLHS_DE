import { useEffect } from 'react'

const PORTAL_HOST = 'id.pmh.com.vn'

/**
 * Was QLHS opened FROM the PMH ID portal ("Mở dự án")? Primary signal is `?sso=1`,
 * which the portal appends to the launch URL; `document.referrer` is a fragile
 * fallback (a Referrer-Policy header can strip it). Only a portal-origin landing
 * hands off to SSO automatically — a direct visit keeps the email form (and its
 * break-glass SA path). Mirrors QLTS.
 */
export function cameFromPortal(search: string, referrer: string): boolean {
  if (new URLSearchParams(search).get('sso') === '1') return true
  try {
    return new URL(referrer).hostname === PORTAL_HOST
  } catch {
    return false
  }
}

/** Auto-hand-off only when anonymous, opened from the portal, and not just bounced
 *  back from a denied login (`?auth_error=` → would loop). Pure for unit tests. */
export function shouldAutostartSso(opts: {
  anonymous: boolean
  authError: boolean
  search: string
  referrer: string
}): boolean {
  return opts.anonymous && !opts.authError && cameFromPortal(opts.search, opts.referrer)
}

/**
 * When arriving from the portal with a live IdP session, redirect to
 * /api/auth/login so the round-trip completes with no email retype. Returns
 * whether a redirect is in flight so the caller can show a "checking session"
 * screen instead of flashing the login form.
 */
export function useSsoAutostart(opts: { anonymous: boolean; authError: boolean }): boolean {
  const go = shouldAutostartSso({
    ...opts,
    search: window.location.search,
    referrer: document.referrer,
  })
  useEffect(() => {
    if (go) window.location.href = '/api/auth/login'
  }, [go])
  return go
}
