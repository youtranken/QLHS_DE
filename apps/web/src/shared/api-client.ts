import { toast } from './toast'
import { t } from '../i18n'

const BASE = '/api'

interface ApiErrorBody {
  code?: string
  message?: string
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: string,
    message?: string,
  ) {
    super(message ?? code ?? `HTTP ${status}`)
    this.name = 'ApiClientError'
  }
}

// Session-expiry hook (FR #3). A 401 on a real endpoint mid-session means the
// cookie died while the user was working → bounce to login. /auth/* 401s are
// NOT expiry (initial /auth/me, wrong password, post-logout /auth/me) so they
// are excluded. Fires once (a full reload follows anyway).
let expiring = false
let warnedExpiry = false
let onSessionExpired: () => void = () => {
  window.location.replace('/?expired=1')
}
export function setOnSessionExpired(fn: () => void): void {
  onSessionExpired = fn
  expiring = false
  warnedExpiry = false
}

// A modal/form is open → the user has unsaved input. A background poll's 401 must
// not navigate away and discard it; defer the bounce until an interactive call
// 401s with nothing open.
function hasUnsavedWork(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[role="dialog"]') != null
}

async function handle<T>(res: Response, path: string): Promise<T> {
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/') && !expiring) {
      if (hasUnsavedWork()) {
        if (!warnedExpiry) {
          warnedExpiry = true
          toast.err(t('auth.login.sessionExpiredKeepEditing'))
        }
      } else {
        expiring = true
        onSessionExpired()
      }
    }
    // Surface the server error envelope { code, message } (DomainErrorFilter)
    // so callers can distinguish 409 AlreadyPicked from 403 Forbidden, etc.
    let body: ApiErrorBody | undefined
    try {
      body = (await res.json()) as ApiErrorBody
    } catch {
      /* non-JSON error body — fall back to the status */
    }
    throw new ApiClientError(res.status, body?.code, body?.message)
  }
  return (await res.json()) as T
}

// Session cookie travels via credentials: 'include'; the SPA never sees tokens.
export function apiGet<T>(path: string): Promise<T> {
  return fetch(`${BASE}${path}`, { credentials: 'include' }).then((r) => handle<T>(r, path))
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => handle<T>(r, path))
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return fetch(`${BASE}${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => handle<T>(r, path))
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return fetch(`${BASE}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => handle<T>(r, path))
}

export function apiDelete<T>(path: string): Promise<T> {
  return fetch(`${BASE}${path}`, { method: 'DELETE', credentials: 'include' }).then((r) => handle<T>(r, path))
}
