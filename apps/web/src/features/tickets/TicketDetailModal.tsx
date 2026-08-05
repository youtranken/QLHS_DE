import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { TicketDetail } from './TicketDetail'
import { useBackdropClose } from '../../shared/useBackdropClose'
import { t } from '../../i18n'

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** The ticket detail as a popup (⋯ → Xem chi tiết), same shell as the create
 *  modal. The detail content is rendered embedded (no back button). */
export function TicketDetailModal({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    return () => opener?.focus()
  }, [])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (!nodes) return
    const list = Array.from(nodes).filter((el) => el.offsetParent !== null)
    if (list.length === 0) return
    const firstEl = list[0]!
    const lastEl = list[list.length - 1]!
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault()
      lastEl.focus()
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault()
      firstEl.focus()
    }
  }

  const backdrop = useBackdropClose(onClose)

  return (
    <div role="presentation" className="overlay" onKeyDown={onKeyDown} onMouseDown={backdrop.onMouseDown} onClick={backdrop.onClick}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="td-modal-title"
        className="modal detailmodal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mt">
          <span className="ttl" id="td-modal-title">
            {t('tickets.detail.modalTitle')}
          </span>
          <button type="button" className="x" aria-label={t('common.actions.close')} onClick={onClose}>
            <X size={15} aria-hidden />
          </button>
        </div>
        <div className="mb">
          <TicketDetail ticketId={ticketId} embedded />
        </div>
      </div>
    </div>
  )
}
