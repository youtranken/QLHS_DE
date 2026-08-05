import { ROLE, type Role } from '@qlhs/contracts'
import { DomainError } from '../errors'

export class SelfLockoutError extends DomainError {
  readonly code = 'SelfLockout'
}

/** An Admin must not strip their OWN Admin role — that would lock them out of the
 *  console with no admin left to restore it (AD-7). Demoting other users is fine. */
export function assertNotSelfLockout(
  currentSub: string,
  targetSub: string,
  newRoles: readonly Role[],
): void {
  if (currentSub === targetSub && !newRoles.includes(ROLE.Admin)) {
    throw new SelfLockoutError('Không thể tự gỡ quyền Admin của chính mình')
  }
}
