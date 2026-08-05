import { applyVp } from '../../i18n'
import { statusVi } from './statusLabel'
import { CLOSED, RETURN_STATES } from './ticketStates'

/** Two-line status: English canonical chip (AD-13) with the Vietnamese gloss
 *  below it, so a narrow column keeps both readable instead of truncating. */
export function StatusCell({ status }: { status: string }) {
  const cls =
    status === 'Completed' || CLOSED.has(status)
      ? 'chip done'
      : RETURN_STATES.has(status)
        ? 'chip sla'
        : 'chip'
  return (
    <span className="statuscell">
      <span className={cls}>
        <span className="dot" aria-hidden />
        <span lang="en">{applyVp(status)}</span>
      </span>
      <small className="vi">{statusVi(status)}</small>
    </span>
  )
}
