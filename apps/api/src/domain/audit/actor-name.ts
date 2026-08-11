import { SYSTEM_SUB } from '@qlhs/contracts'

/**
 * Display name for an audit actor sub: the resolved directory name if present,
 * else "Hệ thống" for the system actor (e.g. the Pool auto-return), else the raw
 * sub as a canonical fallback. Keeps the system actor from surfacing as a bare
 * "system" on any user-facing audit surface.
 */
export function actorDisplayName(sub: string, resolved: string | undefined | null): string {
  if (resolved) return resolved
  return sub === SYSTEM_SUB ? 'Hệ thống' : sub
}
