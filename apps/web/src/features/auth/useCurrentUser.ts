import { useCallback, useEffect, useState } from 'react'
import type { Role } from '@qlhs/contracts'
import { apiGet, apiPost } from '../../shared/api-client'

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
      const user = await apiGet<CurrentUser>('/auth/me')
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
