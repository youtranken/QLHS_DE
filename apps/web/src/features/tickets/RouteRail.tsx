import type { RouteStation } from './api'
import { displaySub } from '../../shared/format'
import { statusVi } from './statusLabel'
import { t } from '../../i18n'

/** Horizontal mini metro in the expanded applicant row (rail2). */
export function RouteRail({ route, directory }: { route: RouteStation[]; directory: Record<string, string> }) {
  return (
    <ol className="rail2" aria-label={t('tickets.routeRail.aria')}>
      {route.map((s, i) => (
        <li key={i} className={`st2 ${s.phase}`} title={statusVi(s.status)}>
          <span className="nd" aria-hidden />
          <span className="lb" lang="en">
            {s.status}
          </span>
          <span className="sr-only">
            {s.phase === 'past'
              ? t('tickets.routeRail.phasePast')
              : s.phase === 'now'
                ? t('tickets.routeRail.phaseNow')
                : t('tickets.routeRail.phaseNext')}
          </span>
          {s.phase === 'now' && <span className="here">{t('tickets.routeRail.here')}</span>}
          {s.holder && <span className="hold">{displaySub(s.holder, directory)}</span>}
        </li>
      ))}
    </ol>
  )
}
