import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '../../i18n'
import { openTicketDetail } from '../../shared/route'
import { subscribeTicketChanges } from '../../shared/ticketStream'
import { getNotifications, markAllRead, markOneRead, type NotificationItem } from './api'
import { messageForKind, relativeTime } from './notificationText'

/**
 * 2.2 — the notification bell. Unread count in a badge, a dropdown of recent
 * items, click a row to jump to the ticket. Refetches on the same SSE stream the
 * boards use (2.1), so the badge updates live without its own polling.
 */
export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async () => {
    try {
      const r = await getNotifications()
      setItems(r.items)
      setUnread(r.unread)
    } catch {
      /* a bell that can't load is silent, not an error banner */
    }
  }, [])

  useEffect(() => {
    void load()
    return subscribeTicketChanges(() => void load())
  }, [load])

  // Close on an outside click or Escape so the dropdown behaves like every other
  // menu; Escape also returns focus to the bell (keyboard users don't get stranded).
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    // Move focus into the dropdown on open so keyboard users don't have to Tab past
    // the whole header to reach it.
    ref.current?.querySelector<HTMLElement>('.notifpop button, .notifpop [href]')?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function openItem(n: NotificationItem) {
    setOpen(false)
    if (!n.read) {
      setUnread((u) => Math.max(0, u - 1))
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      await markOneRead(n.id).catch(() => void load())
    }
    openTicketDetail(n.code ?? n.ticketId)
  }

  async function clearAll() {
    setUnread(0)
    setItems((list) => list.map((x) => ({ ...x, read: true })))
    await markAllRead().catch(() => void load())
  }

  const now = Date.now()

  return (
    <div className="notifwrap" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        className="notifbtn"
        aria-label={unread > 0 ? t('bell.ariaUnread', { n: unread }) : t('bell.title')}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="notifbadge" aria-hidden>{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notifpop" aria-label={t('bell.title')}>
          <div className="notifhd">
            <span>{t('bell.title')}</span>
            {unread > 0 && (
              <button type="button" className="linkbtn" onClick={() => void clearAll()}>
                {t('bell.markAllRead')}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="notifempty">{t('bell.empty')}</p>
          ) : (
            <ul className="notiflist">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={n.read ? 'notifitem' : 'notifitem unread'}
                    onClick={() => void openItem(n)}
                  >
                    {!n.read && <span className="notifdot" aria-hidden />}
                    <span className="notiftxt">
                      <span className="msg">{messageForKind(n.kind)}</span>
                      <span className="meta">
                        {n.code ?? n.ticketId.slice(0, 8)} · {relativeTime(n.createdAt, now)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
