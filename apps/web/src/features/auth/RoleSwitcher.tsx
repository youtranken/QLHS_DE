import type { Role } from '@qlhs/contracts'
import { t } from '../../i18n'

/** H3: role pills in the topbar, shown only when the user holds >1 role. */
export function RoleSwitcher({
  roles,
  activeRole,
  onChange,
}: {
  roles: Role[]
  activeRole: Role | null
  onChange: (role: Role) => void
}) {
  if (roles.length <= 1) return null
  return (
    <div className="roles" role="group" aria-label={t('auth.roleSwitcher.aria')}>
      {roles.map((r) => (
        <button
          key={r}
          type="button"
          lang="en"
          className={r === activeRole ? 'on' : undefined}
          aria-pressed={r === activeRole}
          onClick={() => onChange(r)}
        >
          {r}
        </button>
      ))}
    </div>
  )
}
