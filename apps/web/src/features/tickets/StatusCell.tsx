import { applyVp } from '../../i18n'
import { statusVi } from './statusLabel'
import { CLOSED, RETURN_STATES } from './ticketStates'

/** Single-line status: the English canonical chip (AD-13). The Vietnamese gloss is
 *  the chip's tooltip so the cell stays one line and every row shares a height. */
export function StatusCell({ status }: { status: string }) {
  const cls =
    status === 'Completed' || CLOSED.has(status)
      ? 'chip done'
      : RETURN_STATES.has(status)
        ? 'chip sla'
        : 'chip'
  return (
    <span className={cls} title={statusVi(status)}>
      <span className="dot" aria-hidden />
      <span lang="en">{applyVp(status)}</span>
    </span>
  )
}
