import { useCallback, useEffect, useState } from 'react'
import type { Role } from '@qlhs/contracts'
import { apiGet, apiPost } from '../../shared/api-client'
import { loadPublicConfig } from '../../shared/appConfig'

export interface CurrentUser {
  sub: string
  roles: Role[]
  activeRole: Role | null
  displayName?: string
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'authed'; user: CurrentUser }

/**
 * Reads /auth/me. 401 → anonymous (route guard redirects to login). The SPA
 * holds no token — only the httpOnly session cookie. Migrates to TanStack Query
 * once the query client + web test harness land in story 1.5.
 */
export function useCurrentUser() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const load = useCallback(async () => {
    try {
      // Apply the VP display name before the first authed render so labels never
      // flash the default; loadPublicConfig never rejects.
      const [user] = await Promise.all([apiGet<CurrentUser>('/auth/me'), loadPublicConfig()])
      setState({ status: 'authed', user })
    } catch {
      setState({ status: 'anon' })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const setActiveRole = useCallback(
    async (role: Role) => {
      await apiPost('/auth/active-role', { role })
      await load()
    },
    [load],
  )

  return { state, reload: load, setActiveRole }
}
