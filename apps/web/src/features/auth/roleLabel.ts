import { ROLE, type Role } from '@qlhs/contracts'
import { t } from '../../i18n'

/** Friendly Vietnamese role label shown under the name in the user card (Admin
 *  sidebar + board header): Admin→Quản trị viên, Applicant→Nhân viên, DCC1/2/3→
 *  Admin1/2/3. Called per render so a locale switch re-evaluates. */
export function roleLabel(role: Role | null): string {
  switch (role) {
    case ROLE.Admin:
      return t('shell.roleLabel.Admin')
    case ROLE.Applicant:
      return t('shell.roleLabel.Applicant')
    case ROLE.Dcc1:
      return t('shell.roleLabel.DCC1')
    case ROLE.Dcc2:
      return t('shell.roleLabel.DCC2')
    case ROLE.Dcc3:
      return t('shell.roleLabel.DCC3')
    default:
      return ''
  }
}
