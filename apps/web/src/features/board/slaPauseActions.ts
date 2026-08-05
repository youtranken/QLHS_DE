import type { BoardCard, LegalAction } from './api'
import { t } from '../../i18n'

/** Client-side pseudo-events; the FE routes them to the pause endpoints, they are
 *  not state-machine edges (a pause never changes status — F8). */
export const PAUSE_EVENT = '__sla-pause'
export const RESUME_EVENT = '__sla-resume'

// Built per call so labels follow the active locale (t() reads the live dict).
const pauseAction = (): LegalAction => ({
  event: PAUSE_EVENT,
  label: t('board.pause.pauseAction'),
  toStatus: '',
  reversible: false,
  reasonRequired: true,
})
const resumeAction = (): LegalAction => ({
  event: RESUME_EVENT,
  label: t('board.pause.resumeAction'),
  toStatus: '',
  reversible: false,
  reasonRequired: false,
})

/**
 * F8 — only the holder is offered the clock control, because only they can
 * answer for the wait (the server enforces the same rule).
 */
export function slaActionsFor(card: BoardCard): LegalAction[] {
  if (!card.mine) return []
  return card.paused ? [resumeAction()] : [pauseAction()]
}
