import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { t } from '../i18n'
import { subscribeToasts, dismissToast, type ToastItem, type ToastAction } from './toast'

/** The action button, with a live "(Ns)" countdown when the toast set one (Undo). */
function ToastActionButton({ action, secs, onRun }: { action: ToastAction; secs?: number; onRun: () => void }) {
  const [left, setLeft] = useState(secs ?? 0)
  useEffect(() => {
    if (!secs) return
    const iv = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000)
    return () => clearInterval(iv)
  }, [secs])
  return (
    <button type="button" className="tact" onClick={onRun}>
      {secs ? `${action.label} (${left}s)` : action.label}
    </button>
  )
}

const ICON: Record<ToastItem['kind'], string> = {
  ok: 'M20 6 9 17l-5-5',
  err: 'M12 8v5M12 16h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  info: 'M12 16v-5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
}

/** Single mount point for the toast stack (App root). Fixed, theme-aware, and
 *  announced politely; error toasts assert. Undo-style toasts carry an action. */
export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => subscribeToasts(setItems), [])
  if (items.length === 0) return null

  return (
    <div className="toasts" role="region" aria-label={t('common.toasts.regionAria')}>
      {items.map((it) => (
        <div key={it.id} className={`toast ${it.kind}`} role={it.kind === 'err' ? 'alert' : 'status'}>
          <svg className="tico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={ICON[it.kind]} />
          </svg>
          <span className="tmsg">{it.text}</span>
          {it.action && (
            <ToastActionButton
              action={it.action}
              secs={it.countdownSecs}
              onRun={() => {
                void it.action!.run()
                dismissToast(it.id)
              }}
            />
          )}
          <button type="button" className="tx" aria-label={t('common.actions.close')} onClick={() => dismissToast(it.id)}>
            <X size={14} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  )
}
