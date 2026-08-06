import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { createTicket, type CreateTicketBody } from './api'
import { TicketFieldsFieldset } from './TicketFieldsFieldset'
import { toast } from '../../shared/toast'
import { useBackdropClose } from '../../shared/useBackdropClose'
import { t } from '../../i18n'

// Focusable elements for the trap — exclude disabled ones so the boundary is
// always reachable (a disabled Save button while busy must not break the trap).
const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const EMPTY: CreateTicketBody = {
  documentType: 'General',
  description: '',
  paymentTerm: '',
  contractNo: '',
  projectTeam: '',
  currency: 'VND',
  amount: '',
  budgetCode: '',
  contractor: '',
  priority: 'normal',
}

// Clone bus: a ticket row (elsewhere in the tree) asks the create form — mounted
// as a sibling — to open pre-filled. Module-level, mirroring the toast bus, so no
// prop-drilling across the MyTickets ↔ action boundary.
let seedListener: ((seed: CreateTicketBody) => void) | null = null
export function openCreateFormWith(seed: CreateTicketBody): void {
  seedListener?.(seed)
}

export function CreateTicketForm({ onCreated }: { onCreated: () => void }) {
  // Built per render (not module-level) so a future locale switch re-evaluates.
  const PRIOS: Array<{ v: string; label: string }> = [
    { v: 'normal', label: t('tickets.createForm.prioNormal') },
    { v: 'rush', label: t('tickets.createForm.prioRush') },
  ]
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CreateTicketBody>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLFormElement>(null)

  const set = (k: keyof CreateTicketBody, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const backdrop = useBackdropClose(() => setOpen(false))

  // A ticket row can open this form pre-filled (clone). Registered once.
  useEffect(() => {
    seedListener = (seed) => {
      setForm(seed)
      setError(null)
      setOpen(true)
    }
    return () => {
      seedListener = null
    }
  }, [])

  // Move focus into the dialog on open, restore it to the opener on close.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    return () => opener?.focus()
  }, [open])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
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

  // Fresh open resets any leftover input (e.g. after a clone was closed without
  // submitting) so the next ticket doesn't inherit stale/duplicate data.
  function openFresh() {
    setForm(EMPTY)
    setError(null)
    setOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    // The native-required inputs (Subject/Contractor/…) are already gated by the
    // browser before onSubmit fires; the dropdown-rendered required fields are NOT
    // (a custom Select can't carry `required`), so validate them here explicitly.
    const missing: string[] = []
    if (!form.projectTeam.trim()) missing.push('Project/Team')
    if (!form.paymentTerm.trim()) missing.push('Payment Term')
    if (missing.length > 0) {
      setError(t('tickets.createForm.errRequiredFields', { fields: missing.join(', ') }))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createTicket(form)
      setForm(EMPTY)
      setOpen(false)
      toast.ok(t('tickets.createForm.createdToast'))
      onCreated()
    } catch {
      // Required fields are validated above, so a failure here is a server/transport
      // error — don't mislead the user into re-checking their inputs.
      setError(t('tickets.createForm.errCreateServer'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="btn primary" onClick={openFresh}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {t('tickets.createForm.title')}
      </button>
      {open && (
        <div
          className="overlay"
          role="presentation"
          onKeyDown={onKeyDown}
          onMouseDown={backdrop.onMouseDown}
          onClick={backdrop.onClick}
        >
          <form
            ref={dialogRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ct-title"
            onSubmit={submit}
          >
            <div className="mt">
              <span className="ttl" id="ct-title">
                {t('tickets.createForm.title')}
              </span>
              <button type="button" className="x" aria-label={t('tickets.createForm.closeAria')} onClick={() => setOpen(false)}>
                <X size={15} aria-hidden />
              </button>
            </div>
            <div className="mb">
              <div className="fg">
                <TicketFieldsFieldset form={form} set={set} />
                <div className="field full">
                  <span id="ct-priority-lbl" className="fglbl" lang="en">
                    Priority
                  </span>
                  <div className="prios" role="group" aria-labelledby="ct-priority-lbl">
                    {PRIOS.map((p) => (
                      <button
                        key={p.v}
                        type="button"
                        aria-pressed={form.priority === p.v}
                        className={`p ${p.v} ${form.priority === p.v ? 'on' : ''}`}
                        onClick={() => set('priority', p.v)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {error && (
                <p role="alert" className="err">
                  {error}
                </p>
              )}
            </div>
            <div className="mf">
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
                {t('tickets.createForm.cancelBtn')}
              </button>
              <span className="sp" />
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? t('tickets.createForm.submitting') : t('tickets.createForm.submitBtn')}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
